const mongoose = require('mongoose');

const entrySchema = new mongoose.Schema(
  {
    date:     { type: String, default: '' }, // YYYY-MM-DD
    clockIn:  { type: String, default: '' }, // HH:MM
    lunchOut: { type: String, default: '' }, // HH:MM
    lunchIn:  { type: String, default: '' }, // HH:MM
    clockOut: { type: String, default: '' }, // HH:MM
    reason:   { type: String, default: '' }, // per-row reason
  },
  { _id: false }
);

const timeCorrectionSchema = new mongoose.Schema(
  {
    employee:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    entries:    { type: [entrySchema], required: true },
    reason:     { type: String, default: '' }, // kept for backwards compat
    status:     { type: String, enum: ['pending', 'approved', 'denied'], default: 'pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewNote: { type: String, default: '' },
  },
  { timestamps: true }
);

timeCorrectionSchema.index({ employee: 1, status: 1 });

module.exports = mongoose.model('TimeCorrection', timeCorrectionSchema);
