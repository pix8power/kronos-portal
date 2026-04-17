const mongoose = require('mongoose');

const recurringSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dayOfWeek: { type: Number, min: 0, max: 6, required: true }, // 0=Sun
    label: { type: String, default: '' }, // e.g. "School", "Second job"
  },
  { timestamps: true }
);

recurringSchema.index({ employee: 1, dayOfWeek: 1 }, { unique: true });

module.exports = mongoose.model('RecurringUnavailability', recurringSchema);
