const router = require('express').Router();
const OpenShift = require('../models/OpenShift');
const Shift = require('../models/Shift');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { sendPush } = require('../utils/sendPush');

const PRIVILEGED = ['admin', 'manager', 'charge_nurse'];

// HH:MM → decimal hours
function toHours(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h + m / 60;
}

function shiftHours(start, end) {
  let h = toHours(end) - toHours(start);
  if (h < 0) h += 24; // overnight
  return h;
}

// ISO week bounds (Mon–Sun) for a YYYY-MM-DD string
function weekBounds(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=Sun
  const diffToMon = (day + 6) % 7;
  const mon = new Date(d); mon.setDate(d.getDate() - diffToMon);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = (x) => x.toISOString().slice(0, 10);
  return { weekStart: fmt(mon), weekEnd: fmt(sun) };
}

// GET open shifts — populate seniorityDate on claimants
router.get('/', auth, async (req, res) => {
  try {
    const { status = 'open', startDate, endDate } = req.query;
    const query = { status };
    if (startDate && endDate) query.date = { $gte: startDate, $lte: endDate };
    const shifts = await OpenShift.find(query)
      .populate('createdBy', 'name')
      .populate('claims.employee', 'name color position seniorityDate')
      .populate('approvedEmployee', 'name color')
      .sort({ date: 1, startTime: 1 });
    res.json(shifts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create open shift (privileged)
router.post('/', auth, async (req, res) => {
  if (!PRIVILEGED.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
  try {
    const { date, startTime, endTime, position, department, notes } = req.body;
    const shift = await OpenShift.create({ date, startTime, endTime, position, department, notes, createdBy: req.user._id });
    await shift.populate('createdBy', 'name');

    // Target employees matching position and/or department; fall back to all employees
    const empFilter = { role: 'employee' };
    if (position) empFilter.position = position;
    if (department) empFilter.department = department;
    let users = await User.find(empFilter, '_id');
    // If no match with filters, notify all employees
    if (users.length === 0) {
      users = await User.find({ role: 'employee' }, '_id');
    }
    for (const u of users) {
      sendPush(u._id.toString(), {
        title: '📋 Open Shift Available',
        body: `${date} ${startTime}–${endTime}${position ? ` · ${position}` : ''} — tap to claim!`,
        data: { url: '/schedule' },
      }).catch(() => {});
    }

    res.status(201).json(shift);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST claim a shift
router.post('/:id/claim', auth, async (req, res) => {
  try {
    const shift = await OpenShift.findById(req.params.id);
    if (!shift || shift.status !== 'open') return res.status(400).json({ message: 'Shift not available' });
    const alreadyClaimed = shift.claims.some((c) => c.employee.toString() === req.user._id.toString());
    if (alreadyClaimed) return res.status(409).json({ message: 'Already claimed' });

    shift.claims.push({ employee: req.user._id });
    await shift.save();
    await shift.populate('claims.employee', 'name color position seniorityDate');

    sendPush(shift.createdBy.toString(), {
      title: 'Shift Claimed',
      body: `${req.user.name} claimed the open shift on ${shift.date}.`,
      data: { url: '/schedule' },
    }).catch(() => {});

    res.json(shift);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH approve a claim → creates real shift, with overtime check
router.patch('/:id/approve', auth, async (req, res) => {
  if (!PRIVILEGED.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
  try {
    const { employeeId, force } = req.body;
    const openShift = await OpenShift.findById(req.params.id);
    if (!openShift || openShift.status !== 'open') return res.status(400).json({ message: 'Shift not available' });

    // ── Overtime check ────────────────────────────────────────────────────────
    const { weekStart, weekEnd } = weekBounds(openShift.date);
    const weekShifts = await Shift.find({
      employee: employeeId,
      date: { $gte: weekStart, $lte: weekEnd },
      status: { $ne: 'cancelled' },
    });
    const currentHours = weekShifts.reduce((sum, s) => sum + shiftHours(s.startTime, s.endTime), 0);
    const newHours = shiftHours(openShift.startTime, openShift.endTime);
    const totalHours = currentHours + newHours;
    const OT_THRESHOLD = 40;
    const willBeOvertime = totalHours > OT_THRESHOLD;

    if (willBeOvertime && !force) {
      return res.status(409).json({
        code: 'OVERTIME_WARNING',
        message: `Awarding this shift will bring ${totalHours.toFixed(1)} hrs this week (overtime threshold: ${OT_THRESHOLD} hrs).`,
        currentHours: parseFloat(currentHours.toFixed(2)),
        newHours: parseFloat(newHours.toFixed(2)),
        totalHours: parseFloat(totalHours.toFixed(2)),
        threshold: OT_THRESHOLD,
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    const realShift = await Shift.create({
      employee: employeeId,
      date: openShift.date,
      startTime: openShift.startTime,
      endTime: openShift.endTime,
      position: openShift.position,
      department: openShift.department,
      notes: openShift.notes,
      createdBy: req.user._id,
    });

    openShift.approvedEmployee = employeeId;
    openShift.status = 'filled';
    await openShift.save();

    sendPush(employeeId.toString(), {
      title: 'Open Shift Approved!',
      body: `You've been approved for the shift on ${openShift.date} (${openShift.startTime}–${openShift.endTime}).`,
      data: { url: '/schedule' },
    }).catch(() => {});

    res.json({ openShift, realShift, overtimeAwarded: willBeOvertime, totalHours: parseFloat(totalHours.toFixed(2)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE cancel open shift
router.delete('/:id', auth, async (req, res) => {
  if (!PRIVILEGED.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
  try {
    await OpenShift.findByIdAndUpdate(req.params.id, { status: 'cancelled' });
    res.json({ message: 'Cancelled' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
