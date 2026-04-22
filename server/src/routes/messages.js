const router = require('express').Router();
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { auth } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/crypto');
const { sendPush } = require('../utils/sendPush');

// Decrypt content on a plain message object
function decryptMessage(msg) {
  const obj = msg.toObject ? msg.toObject() : { ...msg };
  obj.content = decrypt(obj.content);
  return obj;
}

// Decrypt the lastMessage.content on a plain conversation object
function decryptConversation(conv) {
  const obj = conv.toObject ? conv.toObject() : { ...conv };
  if (obj.lastMessage && obj.lastMessage.content) {
    obj.lastMessage = { ...obj.lastMessage, content: decrypt(obj.lastMessage.content) };
  }
  return obj;
}

// Get all conversations for the current user
router.get('/conversations', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const conversations = await Conversation.find({ participants: userId, deletedFor: { $ne: userId } })
      .populate('participants', 'name email avatar color isOnline lastSeen')
      .populate({ path: 'lastMessage', populate: { path: 'sender', select: 'name' } })
      .sort({ updatedAt: -1 });
    const decrypted = conversations.map(decryptConversation);
    // Pinned conversations first
    decrypted.sort((a, b) => {
      const aPin = a.pinnedBy?.some((id) => id.toString() === userId.toString());
      const bPin = b.pinnedBy?.some((id) => id.toString() === userId.toString());
      if (aPin && !bPin) return -1;
      if (!aPin && bPin) return 1;
      return 0;
    });
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Pin / unpin a conversation
router.patch('/conversations/:id/pin', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const conv = await Conversation.findOne({ _id: req.params.id, participants: userId });
    if (!conv) return res.status(404).json({ message: 'Not found' });
    const isPinned = conv.pinnedBy.some((id) => id.toString() === userId.toString());
    if (isPinned) {
      conv.pinnedBy.pull(userId);
    } else {
      conv.pinnedBy.push(userId);
    }
    await conv.save();
    res.json({ pinned: !isPinned });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete (hide) a conversation for the current user
router.delete('/conversations/:id', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    await Conversation.findOneAndUpdate(
      { _id: req.params.id, participants: userId },
      { $addToSet: { deletedFor: userId } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create or get direct conversation
router.post('/conversations/direct', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    let conversation = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [req.user._id, userId], $size: 2 },
    })
      .populate('participants', 'name email avatar color isOnline lastSeen')
      .populate({ path: 'lastMessage', populate: { path: 'sender', select: 'name' } });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user._id, userId],
        isGroup: false,
        createdBy: req.user._id,
      });
      conversation = await conversation
        .populate('participants', 'name email avatar color isOnline lastSeen');
    }
    res.json(conversation);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create group conversation
router.post('/conversations/group', auth, async (req, res) => {
  try {
    const { name, participants } = req.body;
    const allParticipants = [...new Set([req.user._id.toString(), ...participants])];
    const conversation = await Conversation.create({
      name,
      participants: allParticipants,
      isGroup: true,
      createdBy: req.user._id,
    });
    const populated = await conversation.populate(
      'participants',
      'name email avatar color isOnline lastSeen'
    );
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get messages in a conversation
router.get('/conversations/:id/messages', auth, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const messages = await Message.find({
      conversation: req.params.id,
      deletedFor: { $ne: req.user._id },
    })
      .populate('sender', 'name email avatar color')
      .populate({ path: 'replyTo', populate: { path: 'sender', select: 'name color' } })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    // Mark messages as read
    await Message.updateMany(
      { conversation: req.params.id, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );

    res.json(messages.reverse().map((msg) => {
      const obj = decryptMessage(msg);
      if (obj.replyTo && obj.replyTo.content) {
        obj.replyTo = { ...obj.replyTo, content: decrypt(obj.replyTo.content) };
      }
      return obj;
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Send a message
router.post('/conversations/:id/messages', auth, async (req, res) => {
  try {
    const { content, type, replyTo } = req.body;
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    const message = await Message.create({
      conversation: req.params.id,
      sender: req.user._id,
      content: encrypt(content),
      type: type || 'text',
      readBy: [req.user._id],
      ...(replyTo ? { replyTo } : {}),
    });

    await Conversation.findByIdAndUpdate(req.params.id, { lastMessage: message._id });

    await message.populate('sender', 'name email avatar color');
    await message.populate({ path: 'replyTo', populate: { path: 'sender', select: 'name color' } });
    const obj = decryptMessage(message);
    if (obj.replyTo && obj.replyTo.content) {
      obj.replyTo = { ...obj.replyTo, content: decrypt(obj.replyTo.content) };
    }

    // Emit socket + push notifications to all other participants
    const io = req.app.get('io');
    const senderId = req.user._id.toString();
    conversation.participants.forEach((pid) => {
      const recipientId = pid.toString();
      if (recipientId === senderId) return;
      if (io) {
        io.to(recipientId).emit('messageNotification', {
          conversationId: req.params.id,
          message: obj,
        });
      }
      sendPush(recipientId, {
        title: `New message from ${req.user.name}`,
        body: obj.content?.slice(0, 100) || 'New message',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: { url: '/messages', conversationId: req.params.id },
      }).catch(() => {});
    });

    res.status(201).json(obj);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Mark all messages as read for the current user
router.post('/mark-all-read', auth, async (req, res) => {
  try {
    await Message.updateMany(
      { sender: { $ne: req.user._id }, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get unread message count (distinct conversations with unread messages)
router.get('/unread-count', auth, async (req, res) => {
  try {
    const convIds = await Message.distinct('conversation', {
      sender: { $ne: req.user._id },
      readBy: { $ne: req.user._id },
    });
    res.json({ count: convIds.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete message (for me)
router.delete('/messages/:id', auth, async (req, res) => {
  try {
    await Message.findByIdAndUpdate(req.params.id, {
      $addToSet: { deletedFor: req.user._id },
    });
    res.json({ message: 'Message deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
