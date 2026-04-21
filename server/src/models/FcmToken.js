const mongoose = require('mongoose');

const fcmTokenSchema = new mongoose.Schema({
  user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token:    { type: String, required: true, unique: true },
  platform: { type: String, default: 'android' },
}, { timestamps: true });

module.exports = mongoose.model('FcmToken', fcmTokenSchema);
