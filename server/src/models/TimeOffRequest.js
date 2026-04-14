const mongoose = require('mongoose');

const timeOffSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    type: {
      type: String,
      enum: ['vacation', 'educational', 'bereavement', 'sick', 'personal', 'other'],
      default: 'vacation',
    },
    reason: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'denied'],
      default: 'pending',
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewNote: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TimeOffRequest', timeOffSchema);
