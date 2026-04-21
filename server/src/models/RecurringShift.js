const mongoose = require('mongoose');

const recurringShiftSchema = new mongoose.Schema({
  employee:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dayOfWeek:  { type: Number, min: 0, max: 6, required: true }, // 0=Sun
  startTime:  { type: String, required: true },
  endTime:    { type: String, required: true },
  position:   { type: String, default: '' },
  department: { type: String, default: '' },
  startDate:  { type: String, required: true }, // YYYY-MM-DD
  endDate:    { type: String, default: '' },     // optional, empty = indefinite
  interval:   { type: String, enum: ['weekly', 'biweekly'], default: 'weekly' },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  active:     { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('RecurringShift', recurringShiftSchema);
