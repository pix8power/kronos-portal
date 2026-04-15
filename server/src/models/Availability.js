const mongoose = require('mongoose');

const availabilitySchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    startTime: { type: String, default: '' },
    endTime: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

availabilitySchema.index({ employee: 1, date: 1 }, { unique: true });
availabilitySchema.index({ date: 1 });

module.exports = mongoose.model('Availability', availabilitySchema);
