const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isGroup: { type: Boolean, default: false },
    name: { type: String, default: '' },
    avatar: { type: String, default: '' },
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Conversation', conversationSchema);
