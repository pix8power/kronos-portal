const router = require('express').Router();
const Shift = require('../models/Shift');
const TimeOffRequest = require('../models/TimeOffRequest');
const { auth, isAdmin } = require('../middleware/auth');

// Get shifts by date range
router.get('/shifts', auth, async (req, res) => {
  try {
    const { startDate, endDate, employeeId } = req.query;
    const query = {};
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }
    if (employeeId) query.employee = employeeId;

    const shifts = await Shift.find(query)
      .populate('employee', 'name email color position department avatar')
      .populate('createdBy', 'name')
      .sort({ date: 1, startTime: 1 });
    res.json(shifts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single shift
router.get('/shifts/:id', auth, async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id).populate('employee', 'name email color');
    if (!shift) return res.status(404).json({ message: 'Shift not found' });
    res.json(shift);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create shift
router.post('/shifts', auth, isAdmin, async (req, res) => {
  try {
    const { employee, date, startTime, endTime, position, department, notes } = req.body;
    const shift = await Shift.create({
      employee,
      date,
      startTime,
      endTime,
      position,
      department,
      notes,
      createdBy: req.user._id,
    });
    const populated = await shift.populate('employee', 'name email color position department avatar');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update shift
router.put('/shifts/:id', auth, isAdmin, async (req, res) => {
  try {
    const { date, startTime, endTime, position, department, notes, status } = req.body;
    const shift = await Shift.findByIdAndUpdate(
      req.params.id,
      { date, startTime, endTime, position, department, notes, status },
      { new: true }
    ).populate('employee', 'name email color position department avatar');
    if (!shift) return res.status(404).json({ message: 'Shift not found' });
    res.json(shift);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete shift
router.delete('/shifts/:id', auth, isAdmin, async (req, res) => {
  try {
    await Shift.findByIdAndDelete(req.params.id);
    res.json({ message: 'Shift deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- Time Off Requests ---

router.get('/timeoff', auth, async (req, res) => {
  try {
    const query = req.user.role === 'employee' ? { employee: req.user._id } : {};
    const requests = await TimeOffRequest.find(query)
      .populate('employee', 'name email color')
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/timeoff', auth, async (req, res) => {
  try {
    const { startDate, endDate, type, reason } = req.body;
    const request = await TimeOffRequest.create({
      employee: req.user._id,
      startDate,
      endDate,
      type,
      reason,
    });
    const populated = await request.populate('employee', 'name email color');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/timeoff/:id', auth, isAdmin, async (req, res) => {
  try {
    const { status, reviewNote } = req.body;
    const request = await TimeOffRequest.findByIdAndUpdate(
      req.params.id,
      { status, reviewNote, reviewedBy: req.user._id },
      { new: true }
    ).populate('employee', 'name email color');
    res.json(request);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
