const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    startTime: { type: String, required: true }, // HH:MM
    endTime: { type: String, required: true }, // HH:MM
    position: { type: String, default: '' },
    department: { type: String, default: '' },
    notes: { type: String, default: '' },
    status: {
      type: String,
      enum: ['scheduled', 'confirmed', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    clockIn: { type: Date },
    clockOut: { type: Date },
  },
  { timestamps: true }
);

shiftSchema.index({ employee: 1, date: 1 });
shiftSchema.index({ date: 1 });

module.exports = mongoose.model('Shift', shiftSchema);
