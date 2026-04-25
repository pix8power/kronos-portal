const router = require('express').Router();
const TimeCorrection = require('../models/TimeCorrection');
const Shift = require('../models/Shift');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { sendPush } = require('../utils/sendPush');

// Convert HH:MM (24h) → h:MM AM/PM
const to12h = (t) => {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
};

// GET — employees see own; admin/manager see all
router.get('/', auth, async (req, res) => {
  try {
    const query = req.user.role === 'employee' ? { employee: req.user._id } : {};
    const { status } = req.query;
    if (status) query.status = status;

    const requests = await TimeCorrection.find(query)
      .populate('employee', 'name email color position')
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST — submit a new correction
router.post('/', auth, async (req, res) => {
  try {
    const { entries, reason, password } = req.body;

    if (!entries || entries.length === 0) {
      return res.status(400).json({ message: 'At least one entry is required.' });
    }

    // Verify password before accepting submission
    if (!password) {
      return res.status(400).json({ message: 'Password confirmation is required.' });
    }
    const fullUser = await User.findById(req.user._id);
    const valid = await fullUser.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid password. Please try again.' });
    }

    const request = await TimeCorrection.create({
      employee: req.user._id,
      entries,
      reason,
    });

    const populated = await request.populate('employee', 'name email color position');

    // ── Push-notify managers/admins ───────────────────────────────────────────
    try {
      const managers = await User.find({ role: { $in: ['admin', 'manager'] } }, '_id');
      for (const manager of managers) {
        if (manager._id.toString() === req.user._id.toString()) continue;
        sendPush(manager._id.toString(), {
          title: `Time Correction from ${req.user.name}`,
          body: 'A new time correction request was submitted.',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          data: { url: '/' },
        }).catch(() => {});
      }
    } catch (notifyErr) {
      console.error('Manager push error:', notifyErr.message);
    }
    // ─────────────────────────────────────────────────────────────────────────

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH — approve / deny (admin/manager only)
router.patch('/:id', auth, async (req, res) => {
  try {
    const { role, name } = req.user;
    if (role !== 'admin' && role !== 'manager') {
      console.warn(`[TimeCorrectionReview] Denied: "${name}" has role "${role}"`);
      return res.status(403).json({
        message: `Access denied — your account role is "${role}". Only admin or manager can review corrections.`,
      });
    }

    const { status, reviewNote } = req.body;
    if (!['approved', 'denied'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be "approved" or "denied".' });
    }

    const request = await TimeCorrection.findByIdAndUpdate(
      req.params.id,
      { status, reviewNote, reviewedBy: req.user._id },
      { new: true }
    )
      .populate('employee', 'name email color position department')
      .populate('reviewedBy', 'name');

    if (!request) return res.status(404).json({ message: 'Request not found' });

    if (status === 'approved') {
      const correctionNote = `Time correction – approved by ${req.user.name}`;
      for (const entry of request.entries) {
        if (!entry.date) continue;
        const hasIn  = !!entry.clockIn;
        const hasOut = !!entry.clockOut;
        if (!hasIn && !hasOut) continue;

        const existing = await Shift.findOne({ employee: request.employee._id, date: entry.date });
        if (existing) {
          const upd = { status: 'confirmed', notes: correctionNote };
          if (hasIn)  upd.startTime = entry.clockIn;
          if (hasOut) upd.endTime   = entry.clockOut;
          await existing.updateOne({ $set: upd });
        } else if (hasIn && hasOut) {
          await Shift.create({
            employee:   request.employee._id,
            date:       entry.date,
            startTime:  entry.clockIn,
            endTime:    entry.clockOut,
            position:   request.employee.position  || '',
            department: request.employee.department || '',
            notes:      correctionNote,
            status:     'confirmed',
            createdBy:  req.user._id,
          });
        }
      }
    }

    res.json(request);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /timecorrections/export — CSV download (admin/manager only)
router.get('/export', auth, async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== 'admin' && role !== 'manager') {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const weeks = parseInt(req.query.weeks, 10) || 0;
    const query = {};
    if (weeks > 0) {
      const since = new Date();
      since.setDate(since.getDate() - weeks * 7);
      query.createdAt = { $gte: since };
    }

    const requests = await TimeCorrection.find(query)
      .populate('employee', 'name email position department')
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 });

    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [
      'Employee,Email,Position,Department,Date,Clock In,Lunch Out,Lunch In,Clock Out,Entry Reason,Status,Reviewed By,Review Note,Submitted At',
    ];

    for (const r of requests) {
      for (const e of r.entries) {
        rows.push([
          esc(r.employee?.name),
          esc(r.employee?.email),
          esc(r.employee?.position),
          esc(r.employee?.department),
          esc(e.date),
          esc(to12h(e.clockIn)),
          esc(to12h(e.lunchOut)),
          esc(to12h(e.lunchIn)),
          esc(to12h(e.clockOut)),
          esc(e.reason),
          esc(r.status),
          esc(r.reviewedBy?.name),
          esc(r.reviewNote),
          esc(r.createdAt?.toISOString().slice(0, 10)),
        ].join(','));
      }
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="time-corrections-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(rows.join('\r\n'));
  } catch (err) {
    console.error('Export error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// DELETE — employee deletes own pending request
router.delete('/:id', auth, async (req, res) => {
  try {
    const request = await TimeCorrection.findOne({
      _id: req.params.id,
      employee: req.user._id,
      status: 'pending',
    });
    if (!request) return res.status(404).json({ message: 'Request not found or already reviewed' });
    await request.deleteOne();
    res.json({ message: 'Request deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
