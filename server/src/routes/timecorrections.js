const router = require('express').Router();
const TimeCorrection = require('../models/TimeCorrection');
const Shift = require('../models/Shift');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
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
    const { entries, reason } = req.body;

    if (!entries || entries.length === 0) {
      return res.status(400).json({ message: 'At least one entry is required.' });
    }

    const request = await TimeCorrection.create({
      employee: req.user._id,
      entries,
      reason,
    });

    const populated = await request.populate('employee', 'name email color position');

    // ── Notify managers/admins via direct message ─────────────────────────────
    try {
      const io = req.app.get('io');
      const managers = await User.find({ role: { $in: ['admin', 'manager'] } });

      const entryLines = entries
        .filter((e) => e.date || e.clockIn || e.clockOut)
        .map((e) =>
          `  ${e.date || '—'}  |  In: ${to12h(e.clockIn)}  |  Lunch Out: ${to12h(e.lunchOut)}  |  Lunch In: ${to12h(e.lunchIn)}  |  Out: ${to12h(e.clockOut)}${e.reason ? `  |  Reason: ${e.reason}` : ''}`
        )
        .join('\n');

      const msgContent =
        `📋 Time Correction Request from ${req.user.name}\n\n` +
        `Date       | Clock In  | Lunch Out | Lunch In  | Clock Out | Reason\n` +
        `──────────────────────────────────────────────────────────────\n` +
        entryLines;

      for (const manager of managers) {
        if (manager._id.toString() === req.user._id.toString()) continue;

        let conv = await Conversation.findOne({
          isGroup: false,
          participants: { $all: [req.user._id, manager._id], $size: 2 },
        });

        if (!conv) {
          conv = await Conversation.create({
            participants: [req.user._id, manager._id],
            isGroup: false,
            createdBy: req.user._id,
          });
        }

        const msg = await Message.create({
          conversation: conv._id,
          sender: req.user._id,
          content: msgContent,
          type: 'text',
          readBy: [req.user._id],
        });

        await Conversation.findByIdAndUpdate(conv._id, { lastMessage: msg._id });
        const populatedMsg = await msg.populate('sender', 'name email avatar color');

        if (io) {
          io.to(manager._id.toString()).emit('messageNotification', {
            conversationId: conv._id,
            message: populatedMsg,
          });
          io.to(`conv:${conv._id}`).emit('newMessage', {
            conversationId: conv._id,
            message: populatedMsg,
          });
        }
        sendPush(manager._id.toString(), {
          title: `Time Correction from ${req.user.name}`,
          body: 'A new time correction request was submitted.',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          data: { url: '/time-corrections' },
        }).catch(() => {});
      }
    } catch (notifyErr) {
      console.error('Manager notification error:', notifyErr.message);
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
