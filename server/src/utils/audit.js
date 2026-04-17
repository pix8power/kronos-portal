const AuditLog = require('../models/AuditLog');

async function audit(req, action, entity, entityId, details = {}) {
  try {
    await AuditLog.create({
      user: req.user?._id,
      userName: req.user?.name,
      action,
      entity,
      entityId: entityId?.toString(),
      details,
      ip: req.ip,
    });
  } catch {
    // Never let audit failure break the request
  }
}

module.exports = { audit };
