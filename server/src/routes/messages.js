const router = require('express').Router();
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { auth } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/crypto');

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
    const conversations = await Conversation.find({ participants: req.user._id })
      .populate('participants', 'name email avatar color isOnline lastSeen')
      .populate({ path: 'lastMessage', populate: { path: 'sender', select: 'name' } })
      .sort({ updatedAt: -1 });
    res.json(conversations.map(decryptConversation));
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
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    // Mark messages as read
    await Message.updateMany(
      { conversation: req.params.id, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );

    res.json(messages.reverse().map(decryptMessage));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Send a message
router.post('/conversations/:id/messages', auth, async (req, res) => {
  try {
    const { content, type } = req.body;
    const message = await Message.create({
      conversation: req.params.id,
      sender: req.user._id,
      content: encrypt(content),
      type: type || 'text',
      readBy: [req.user._id],
    });

    await Conversation.findByIdAndUpdate(req.params.id, { lastMessage: message._id });

    const populated = await message.populate('sender', 'name email avatar color');
    res.status(201).json(decryptMessage(populated));
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
