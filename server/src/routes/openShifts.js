const router = require('express').Router();
const OpenShift = require('../models/OpenShift');
const Shift = require('../models/Shift');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { sendPush } = require('../utils/sendPush');

const PRIVILEGED = ['admin', 'manager', 'charge_nurse'];

// GET open shifts
router.get('/', auth, async (req, res) => {
  try {
    const { status = 'open', startDate, endDate } = req.query;
    const query = { status };
    if (startDate && endDate) query.date = { $gte: startDate, $lte: endDate };
    const shifts = await OpenShift.find(query)
      .populate('createdBy', 'name')
      .populate('claims.employee', 'name color position')
      .populate('approvedEmployee', 'name')
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

    // Notify all employees
    const users = await User.find({ role: 'employee' }, '_id');
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
    await shift.populate('claims.employee', 'name color position');

    // Notify creator
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

// PATCH approve a claim → creates real shift
router.patch('/:id/approve', auth, async (req, res) => {
  if (!PRIVILEGED.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
  try {
    const { employeeId } = req.body;
    const openShift = await OpenShift.findById(req.params.id);
    if (!openShift || openShift.status !== 'open') return res.status(400).json({ message: 'Shift not available' });

    // Create actual shift
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

    // Notify approved employee
    sendPush(employeeId.toString(), {
      title: 'Open Shift Approved!',
      body: `You've been approved for the shift on ${openShift.date} (${openShift.startTime}–${openShift.endTime}).`,
      data: { url: '/schedule' },
    }).catch(() => {});

    res.json({ openShift, realShift });
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
