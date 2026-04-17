const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['shift_assigned', 'shift_deleted', 'timeoff_approved', 'timeoff_denied',
             'exchange_response', 'exchange_approved', 'message'],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    read: { type: Boolean, default: false },
    link: { type: String, default: '' }, // client-side route to navigate to
    data: { type: Object, default: {} },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
