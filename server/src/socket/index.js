const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

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
    io.emit('userOnline', { userId });

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
        const { conversationId, content, type } = data;

        // Verify user is in conversation
        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: userId,
        });
        if (!conversation) return;

        const message = await Message.create({
          conversation: conversationId,
          sender: userId,
          content,
          type: type || 'text',
          readBy: [userId],
        });

        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: message._id,
        });

        const populated = await message.populate('sender', 'name email avatar color');

        io.to(`conv:${conversationId}`).emit('newMessage', {
          conversationId,
          message: populated,
        });

        // Notify participants not in the room
        conversation.participants.forEach((participantId) => {
          const pid = participantId.toString();
          if (pid !== userId) {
            io.to(pid).emit('messageNotification', {
              conversationId,
              message: populated,
            });
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
      io.emit('userOffline', { userId, lastSeen: new Date() });
      console.log(`User disconnected: ${socket.user.name}`);
    });
  });
};

module.exports = { initSocket, onlineUsers };
