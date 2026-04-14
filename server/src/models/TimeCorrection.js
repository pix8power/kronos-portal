const mongoose = require('mongoose');

const timeCorrectionSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    originalClockIn: { type: String, default: '' },  // HH:MM
    originalClockOut: { type: String, default: '' }, // HH:MM
    correctedClockIn: { type: String, required: true },
    correctedClockOut: { type: String, required: true },
    lunchOut: { type: String, default: '' }, // HH:MM
    lunchIn: { type: String, default: '' },  // HH:MM
    reason: { type: String, required: true },
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

timeCorrectionSchema.index({ employee: 1, status: 1 });

module.exports = mongoose.model('TimeCorrection', timeCorrectionSchema);
