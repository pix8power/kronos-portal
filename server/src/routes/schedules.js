const router = require('express').Router();
const Shift = require('../models/Shift');
const TimeOffRequest = require('../models/TimeOffRequest');
const Availability = require('../models/Availability');
const ShiftExchange = require('../models/ShiftExchange');
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
    const { status, startDate, endDate } = req.query;
    if (status) query.status = status;
    // Return requests that overlap with the given date range
    if (startDate && endDate) {
      query.startDate = { $lte: endDate };
      query.endDate   = { $gte: startDate };
    }
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

router.patch('/timeoff/:id', auth, async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== 'admin' && role !== 'manager') {
      return res.status(403).json({ message: 'Only admin or manager can review time off requests.' });
    }
    const { status, reviewNote } = req.body;
    const request = await TimeOffRequest.findByIdAndUpdate(
      req.params.id,
      { status, reviewNote, reviewedBy: req.user._id },
      { new: true }
    ).populate('employee', 'name email color').populate('reviewedBy', 'name');
    if (!request) return res.status(404).json({ message: 'Request not found' });
    res.json(request);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/timeoff/:id', auth, async (req, res) => {
  try {
    const request = await TimeOffRequest.findOne({
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

// --- Availability ---

// Get availability (admin/manager sees all; employee sees own)
router.get('/availability', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = {};
    if (req.user.role === 'employee') query.employee = req.user._id;
    if (startDate && endDate) query.date = { $gte: startDate, $lte: endDate };
    const records = await Availability.find(query)
      .populate('employee', 'name email color')
      .sort({ date: 1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Mark self as available on a date
router.post('/availability', auth, async (req, res) => {
  try {
    const { date, startTime, endTime, notes } = req.body;
    const existing = await Availability.findOne({ employee: req.user._id, date });
    if (existing) return res.status(409).json({ message: 'Already marked available for this date' });
    const record = await Availability.create({
      employee: req.user._id,
      date,
      startTime: startTime || '',
      endTime: endTime || '',
      notes: notes || '',
    });
    const populated = await record.populate('employee', 'name email color');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Remove availability (own record only)
router.delete('/availability/:id', auth, async (req, res) => {
  try {
    const query = { _id: req.params.id };
    if (req.user.role === 'employee') query.employee = req.user._id;
    const record = await Availability.findOne(query);
    if (!record) return res.status(404).json({ message: 'Not found' });
    await record.deleteOne();
    res.json({ message: 'Availability removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- Shift Exchange ---

const EXCHANGE_POPULATE = [
  { path: 'shift' },
  { path: 'requestedBy', select: 'name color position' },
  { path: 'acceptedBy', select: 'name color' },
  { path: 'responses.employee', select: 'name color position' },
];

// Get exchanges: admin/manager sees all; employee sees own + open ones they can cover
router.get('/exchanges', auth, async (req, res) => {
  try {
    if (req.user.role === 'admin' || req.user.role === 'manager') {
      const exchanges = await ShiftExchange.find()
        .populate(EXCHANGE_POPULATE)
        .sort({ date: 1, createdAt: -1 });
      return res.json({ requests: exchanges, available: [] });
    }

    // Own requests
    const requests = await ShiftExchange.find({ requestedBy: req.user._id })
      .populate(EXCHANGE_POPULATE)
      .sort({ createdAt: -1 });

    // Open exchanges for same position, not own
    const position = req.user.position;
    const openQuery = { status: 'open', requestedBy: { $ne: req.user._id } };
    if (position) openQuery.position = position;

    let coverable = await ShiftExchange.find(openQuery)
      .populate(EXCHANGE_POPULATE)
      .sort({ date: 1 });

    // Filter out dates where employee is already scheduled
    if (coverable.length) {
      const dates = [...new Set(coverable.map((e) => e.date))];
      const myShifts = await Shift.find({ employee: req.user._id, date: { $in: dates } });
      const busy = new Set(myShifts.map((s) => s.date));
      coverable = coverable.filter((e) => !busy.has(e.date));
    }

    res.json({ requests, available: coverable });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create an exchange request for one of the employee's own shifts
router.post('/exchanges', auth, async (req, res) => {
  try {
    const { shiftId, note } = req.body;
    const shift = await Shift.findById(shiftId);
    if (!shift) return res.status(404).json({ message: 'Shift not found' });
    if (shift.employee.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only exchange your own shifts' });
    }
    const existing = await ShiftExchange.findOne({ shift: shiftId, status: 'open' });
    if (existing) return res.status(409).json({ message: 'An open exchange request already exists for this shift' });

    const exchange = await ShiftExchange.create({
      shift: shiftId,
      requestedBy: req.user._id,
      date: shift.date,
      position: shift.position || req.user.position || '',
      note: note || '',
    });
    const populated = await ShiftExchange.findById(exchange._id).populate(EXCHANGE_POPULATE);
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Respond to an exchange (available / declined)
router.post('/exchanges/:id/respond', auth, async (req, res) => {
  try {
    const { response } = req.body;
    if (!['available', 'declined'].includes(response)) {
      return res.status(400).json({ message: 'Invalid response' });
    }
    const exchange = await ShiftExchange.findById(req.params.id);
    if (!exchange) return res.status(404).json({ message: 'Exchange not found' });
    if (exchange.status !== 'open') return res.status(400).json({ message: 'Exchange is no longer open' });
    if (exchange.requestedBy.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot respond to your own exchange request' });
    }

    const idx = exchange.responses.findIndex(
      (r) => r.employee.toString() === req.user._id.toString()
    );
    if (idx >= 0) {
      exchange.responses[idx].response = response;
      exchange.responses[idx].respondedAt = new Date();
    } else {
      exchange.responses.push({ employee: req.user._id, response });
    }
    await exchange.save();
    const populated = await ShiftExchange.findById(exchange._id).populate(EXCHANGE_POPULATE);
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin/manager: approve exchange and reassign the shift
router.patch('/exchanges/:id', auth, isAdmin, async (req, res) => {
  try {
    const { acceptedBy } = req.body;
    const exchange = await ShiftExchange.findById(req.params.id);
    if (!exchange) return res.status(404).json({ message: 'Exchange not found' });
    if (exchange.status !== 'open') return res.status(400).json({ message: 'Exchange is not open' });

    await Shift.findByIdAndUpdate(exchange.shift, { employee: acceptedBy });
    exchange.acceptedBy = acceptedBy;
    exchange.status = 'approved';
    await exchange.save();

    const populated = await ShiftExchange.findById(exchange._id).populate(EXCHANGE_POPULATE);
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Cancel own open exchange request
router.delete('/exchanges/:id', auth, async (req, res) => {
  try {
    const exchange = await ShiftExchange.findOne({
      _id: req.params.id,
      requestedBy: req.user._id,
      status: 'open',
    });
    if (!exchange) return res.status(404).json({ message: 'Exchange not found or not cancellable' });
    exchange.status = 'cancelled';
    await exchange.save();
    res.json({ message: 'Exchange cancelled' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
