const mongoose = require('mongoose');

const shiftExchangeSchema = new mongoose.Schema(
  {
    shift: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift', required: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD (denormalized)
    position: { type: String, default: '' }, // denormalized for filtering
    note: { type: String, default: '' },
    status: {
      type: String,
      enum: ['open', 'approved', 'cancelled'],
      default: 'open',
    },
    responses: [
      {
        employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        response: { type: String, enum: ['available', 'declined'] },
        availableDates: [{ type: String }],
        respondedAt: { type: Date, default: Date.now },
      },
    ],
    acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

shiftExchangeSchema.index({ date: 1 });
shiftExchangeSchema.index({ requestedBy: 1 });
shiftExchangeSchema.index({ position: 1, status: 1 });

module.exports = mongoose.model('ShiftExchange', shiftExchangeSchema);
