const router = require('express').Router();
const TimeCorrection = require('../models/TimeCorrection');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { auth, isAdmin } = require('../middleware/auth');

// Convert HH:MM (24h) to h:MM AM/PM
const to12h = (t) => {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
};

// Get requests — employees see own, admins/managers see all
router.get('/', auth, async (req, res) => {
  try {
    const query =
      req.user.role === 'employee' ? { employee: req.user._id } : {};

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

// Submit a new correction request
router.post('/', auth, async (req, res) => {
  try {
    const {
      date, originalClockIn, originalClockOut,
      correctedClockIn, correctedClockOut,
      lunchOut, lunchIn, reason,
    } = req.body;

    const request = await TimeCorrection.create({
      employee: req.user._id,
      date,
      originalClockIn,
      originalClockOut,
      correctedClockIn,
      correctedClockOut,
      lunchOut,
      lunchIn,
      reason,
    });

    const populated = await request.populate('employee', 'name email color position');

    // ── Notify all managers/admins via a direct message ──────────────────────
    try {
      const io = req.app.get('io');
      const managers = await User.find({ role: { $in: ['admin', 'manager'] } });

      const lunchLine = (lunchOut || lunchIn)
        ? `\nLunch Break:      Out ${to12h(lunchOut)}  |  In ${to12h(lunchIn)}`
        : '';

      const msgContent =
        `📋 Time Correction Request from ${req.user.name}\n\n` +
        `Date: ${date}\n\n` +
        `Original Time:\n` +
        `  Clock In:  ${to12h(originalClockIn)}\n` +
        `  Clock Out: ${to12h(originalClockOut)}\n\n` +
        `Corrected Time:\n` +
        `  Clock In:  ${to12h(correctedClockIn)}\n` +
        `  Clock Out: ${to12h(correctedClockOut)}` +
        lunchLine +
        `\n\nReason: ${reason}`;

      for (const manager of managers) {
        // Don't message yourself if the submitter is also a manager
        if (manager._id.toString() === req.user._id.toString()) continue;

        // Find or create a direct conversation between employee and manager
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
          // Push to manager's personal room (they receive it wherever they are)
          io.to(manager._id.toString()).emit('messageNotification', {
            conversationId: conv._id,
            message: populatedMsg,
          });
          // Push into the conversation room if manager has it open
          io.to(`conv:${conv._id}`).emit('newMessage', {
            conversationId: conv._id,
            message: populatedMsg,
          });
        }
      }
    } catch (notifyErr) {
      // Don't fail the request just because notification failed
      console.error('Manager notification error:', notifyErr.message);
    }
    // ─────────────────────────────────────────────────────────────────────────

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Review (approve / deny) — admin/manager only
router.patch('/:id', auth, isAdmin, async (req, res) => {
  try {
    const { status, reviewNote } = req.body;
    if (!['approved', 'denied'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const request = await TimeCorrection.findByIdAndUpdate(
      req.params.id,
      { status, reviewNote, reviewedBy: req.user._id },
      { new: true }
    )
      .populate('employee', 'name email color position')
      .populate('reviewedBy', 'name');

    if (!request) return res.status(404).json({ message: 'Request not found' });
    res.json(request);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete own pending request
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
