const mongoose = require('mongoose');

const openShiftSchema = new mongoose.Schema({
  date:        { type: String, required: true },
  startTime:   { type: String, required: true },
  endTime:     { type: String, required: true },
  position:    { type: String, default: '' },
  department:  { type: String, default: '' },
  notes:       { type: String, default: '' },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Employees who claimed
  claims: [{
    employee:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    claimedAt:  { type: Date, default: Date.now },
  }],
  // Approved claim → becomes a real shift
  approvedEmployee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, enum: ['open', 'filled', 'cancelled'], default: 'open' },
}, { timestamps: true });

openShiftSchema.index({ date: 1, status: 1 });

module.exports = mongoose.model('OpenShift', openShiftSchema);
