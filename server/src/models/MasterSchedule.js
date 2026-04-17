const mongoose = require('mongoose');

const templateEntrySchema = new mongoose.Schema(
  {
    week: { type: Number, enum: [1, 2], required: true },
    dayOfWeek: { type: Number, min: 0, max: 6, required: true }, // 0=Sun, 6=Sat
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startTime: { type: String, required: true }, // HH:MM
    endTime: { type: String, required: true }, // HH:MM
    position: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { _id: true }
);

const masterScheduleSchema = new mongoose.Schema(
  {
    name: { type: String, default: 'Master Schedule' },
    // The Sunday that marks the start of Week 1 for the cycle
    anchorDate: { type: String, required: true }, // YYYY-MM-DD (must be a Sunday)
    entries: [templateEntrySchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MasterSchedule', masterScheduleSchema);
