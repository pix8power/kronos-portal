const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { encrypt, decrypt } = require('../utils/crypto');
const { sendPush } = require('../utils/sendPush');

const onlineUsers = new Map(); // userId -> socketId

const initSocket = (io) => {
  // Auth middleware for socket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('No token'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    onlineUsers.set(userId, socket.id);

    // Update user online status
    await User.findByIdAndUpdate(userId, { isOnline: true });
    socket.broadcast.emit('userOnline', { userId });

    console.log(`User connected: ${socket.user.name} (${socket.id})`);

    // Join personal room
    socket.join(userId);

    // Join conversation rooms
    socket.on('joinConversation', (conversationId) => {
      socket.join(`conv:${conversationId}`);
    });

    socket.on('leaveConversation', (conversationId) => {
      socket.leave(`conv:${conversationId}`);
    });

    // Send message via socket
    socket.on('sendMessage', async (data) => {
      try {
        const { conversationId, content, type, replyTo } = data;

        // Verify user is in conversation
        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: userId,
        });
        if (!conversation) return;

        const message = await Message.create({
          conversation: conversationId,
          sender: userId,
          content: encrypt(content),
          type: type || 'text',
          readBy: [userId],
          ...(replyTo ? { replyTo } : {}),
        });

        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: message._id,
        });

        await message.populate('sender', 'name email avatar color');
        await message.populate({ path: 'replyTo', populate: { path: 'sender', select: 'name color' } });

        const obj = message.toObject();
        obj.content = decrypt(obj.content);
        if (obj.replyTo && obj.replyTo.content) {
          obj.replyTo = { ...obj.replyTo, content: decrypt(obj.replyTo.content) };
        }
        const decrypted = obj;

        io.to(`conv:${conversationId}`).emit('newMessage', {
          conversationId,
          message: decrypted,
        });

        // Notify participants not in the room
        conversation.participants.forEach((participantId) => {
          const pid = participantId.toString();
          if (pid !== userId) {
            console.log(`[socket] emitting messageNotification to room="${pid}"`);
            io.to(pid).emit('messageNotification', {
              conversationId,
              message: decrypted,
            });
            // Web push for lock-screen / background notification
            sendPush(pid, {
              title: `New message from ${socket.user.name}`,
              body: decrypted.content?.slice(0, 100) || 'New message',
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              data: { url: '/messages', conversationId },
            }).catch(() => {});
          }
        });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // Typing indicators
    socket.on('typing', ({ conversationId }) => {
      socket.to(`conv:${conversationId}`).emit('userTyping', {
        conversationId,
        userId,
        userName: socket.user.name,
      });
    });

    socket.on('stopTyping', ({ conversationId }) => {
      socket.to(`conv:${conversationId}`).emit('userStopTyping', {
        conversationId,
        userId,
      });
    });

    // Mark messages as read
    socket.on('markRead', async ({ conversationId }) => {
      await Message.updateMany(
        { conversation: conversationId, readBy: { $ne: userId } },
        { $addToSet: { readBy: userId } }
      );
      socket.to(`conv:${conversationId}`).emit('messagesRead', {
        conversationId,
        userId,
      });
    });

    // Disconnect
    socket.on('disconnect', async () => {
      onlineUsers.delete(userId);
      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeen: new Date(),
      });
      socket.broadcast.emit('userOffline', { userId, lastSeen: new Date() });
      console.log(`User disconnected: ${socket.user.name}`);
    });
  });
};

module.exports = { initSocket, onlineUsers };
