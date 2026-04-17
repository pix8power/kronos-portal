const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String },
    action: { type: String, required: true }, // e.g. 'create_shift', 'delete_shift'
    entity: { type: String },                 // e.g. 'Shift', 'TimeOffRequest'
    entityId: { type: String },
    details: { type: Object },                // snapshot of changed data
    ip: { type: String },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ user: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
