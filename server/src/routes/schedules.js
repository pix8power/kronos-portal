const router = require('express').Router();
const Shift = require('../models/Shift');
const TimeOffRequest = require('../models/TimeOffRequest');
const Availability = require('../models/Availability');
const ShiftExchange = require('../models/ShiftExchange');
const RecurringUnavailability = require('../models/RecurringUnavailability');
const { auth, isAdmin } = require('../middleware/auth');
const { audit } = require('../utils/audit');
const { notify } = require('../utils/notify');

// Helper: check for shift conflicts for an employee on a date
async function getConflict(employeeId, date, startTime, endTime, excludeId) {
  const query = { employee: employeeId, date, status: { $ne: 'cancelled' } };
  if (excludeId) query._id = { $ne: excludeId };
  const existing = await Shift.find(query);
  for (const s of existing) {
    if (startTime < s.endTime && endTime > s.startTime) return s;
  }
  return null;
}

// Helper: check approved time-off for an employee on a date
async function getTimeOffConflict(employeeId, date) {
  return TimeOffRequest.findOne({
    employee: employeeId,
    status: 'approved',
    startDate: { $lte: date },
    endDate: { $gte: date },
  });
}

// ── Shifts ───────────────────────────────────────────────────────────────────

router.get('/shifts', auth, async (req, res) => {
  try {
    const { startDate, endDate, employeeId } = req.query;
    const query = {};
    if (startDate && endDate) query.date = { $gte: startDate, $lte: endDate };
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

router.get('/shifts/:id', auth, async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id).populate('employee', 'name email color');
    if (!shift) return res.status(404).json({ message: 'Shift not found' });
    res.json(shift);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create single shift
router.post('/shifts', auth, isAdmin, async (req, res) => {
  try {
    const { employee, date, startTime, endTime, position, department, notes, force } = req.body;

    if (!force) {
      const conflict = await getConflict(employee, date, startTime, endTime);
      if (conflict) {
        return res.status(409).json({
          message: `Shift conflict: ${conflict.startTime}–${conflict.endTime} already exists on ${date}`,
          conflict: true,
          conflictShift: conflict,
        });
      }
      const toConflict = await getTimeOffConflict(employee, date);
      if (toConflict) {
        return res.status(409).json({
          message: `Employee has approved time off on ${date}`,
          conflict: true,
          timeOffConflict: true,
        });
      }
    }

    const shift = await Shift.create({ employee, date, startTime, endTime, position, department, notes, createdBy: req.user._id });
    const populated = await shift.populate('employee', 'name email color position department avatar');
    await audit(req, 'create_shift', 'Shift', shift._id, { employee, date, startTime, endTime });

    // Notify the assigned employee
    const io = req.app.get('io');
    await notify(io, employee, {
      type: 'shift_assigned',
      title: 'New Shift Assigned',
      body: `You have been scheduled on ${date} from ${startTime} to ${endTime}.`,
      link: '/schedule',
      data: { shiftId: shift._id },
    });

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Bulk create shifts (repeat pattern)
router.post('/shifts/bulk', auth, isAdmin, async (req, res) => {
  try {
    const { shifts, force } = req.body; // shifts = array of { employee, date, startTime, endTime, position, department, notes }
    const created = [];
    const skipped = [];
    const io = req.app.get('io');

    for (const s of shifts) {
      if (!force) {
        const conflict = await getConflict(s.employee, s.date, s.startTime, s.endTime);
        const toConflict = await getTimeOffConflict(s.employee, s.date);
        if (conflict || toConflict) { skipped.push({ ...s, reason: conflict ? 'shift_conflict' : 'timeoff_conflict' }); continue; }
      }
      const shift = await Shift.create({ ...s, createdBy: req.user._id });
      const populated = await shift.populate('employee', 'name email color position department avatar');
      created.push(populated);
      await notify(io, s.employee, {
        type: 'shift_assigned',
        title: 'New Shift Assigned',
        body: `You have been scheduled on ${s.date} from ${s.startTime} to ${s.endTime}.`,
        link: '/schedule',
        data: { shiftId: shift._id },
      });
    }
    await audit(req, 'bulk_create_shifts', 'Shift', null, { count: created.length, skipped: skipped.length });
    res.status(201).json({ created, skipped });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/shifts/:id', auth, isAdmin, async (req, res) => {
  try {
    const { date, startTime, endTime, position, department, notes, status } = req.body;
    const existing = await Shift.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Shift not found' });

    const conflict = await getConflict(existing.employee, date || existing.date, startTime || existing.startTime, endTime || existing.endTime, req.params.id);
    if (conflict) {
      return res.status(409).json({
        message: `Shift conflict: ${conflict.startTime}–${conflict.endTime} already exists on ${date}`,
        conflict: true,
      });
    }

    const shift = await Shift.findByIdAndUpdate(req.params.id, { date, startTime, endTime, position, department, notes, status }, { new: true })
      .populate('employee', 'name email color position department avatar');
    await audit(req, 'update_shift', 'Shift', shift._id, { date, startTime, endTime, status });
    res.json(shift);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/shifts/:id', auth, isAdmin, async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id).populate('employee', 'name');
    if (!shift) return res.status(404).json({ message: 'Shift not found' });
    await Shift.findByIdAndDelete(req.params.id);
    await audit(req, 'delete_shift', 'Shift', req.params.id, { date: shift.date });

    const io = req.app.get('io');
    await notify(io, shift.employee._id, {
      type: 'shift_deleted',
      title: 'Shift Removed',
      body: `Your shift on ${shift.date} (${shift.startTime}–${shift.endTime}) has been removed.`,
      link: '/schedule',
    });
    res.json({ message: 'Shift deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Clock in
router.patch('/shifts/:id/clock-in', auth, async (req, res) => {
  try {
    const shift = await Shift.findOne({ _id: req.params.id, employee: req.user._id });
    if (!shift) return res.status(404).json({ message: 'Shift not found' });
    if (shift.clockIn) return res.status(400).json({ message: 'Already clocked in' });
    shift.clockIn = new Date();
    shift.status = 'confirmed';
    await shift.save();
    await audit(req, 'clock_in', 'Shift', shift._id, { time: shift.clockIn });
    res.json(shift);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Clock out
router.patch('/shifts/:id/clock-out', auth, async (req, res) => {
  try {
    const shift = await Shift.findOne({ _id: req.params.id, employee: req.user._id });
    if (!shift) return res.status(404).json({ message: 'Shift not found' });
    if (!shift.clockIn) return res.status(400).json({ message: 'Not clocked in yet' });
    if (shift.clockOut) return res.status(400).json({ message: 'Already clocked out' });
    shift.clockOut = new Date();
    shift.status = 'completed';
    await shift.save();
    await audit(req, 'clock_out', 'Shift', shift._id, { time: shift.clockOut });
    res.json(shift);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Time Off Requests ─────────────────────────────────────────────────────────

router.get('/timeoff', auth, async (req, res) => {
  try {
    const query = req.user.role === 'employee' ? { employee: req.user._id } : {};
    const { status, startDate, endDate } = req.query;
    if (status) query.status = status;
    if (startDate && endDate) { query.startDate = { $lte: endDate }; query.endDate = { $gte: startDate }; }
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
    const request = await TimeOffRequest.create({ employee: req.user._id, startDate, endDate, type, reason });
    const populated = await request.populate('employee', 'name email color');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/timeoff/:id', auth, async (req, res) => {
  try {
    const { role } = req.user;
    if (!['admin', 'manager', 'charge_nurse'].includes(role)) return res.status(403).json({ message: 'Access denied' });
    const { status, reviewNote } = req.body;
    const request = await TimeOffRequest.findByIdAndUpdate(req.params.id, { status, reviewNote, reviewedBy: req.user._id }, { new: true })
      .populate('employee', 'name email color').populate('reviewedBy', 'name');
    if (!request) return res.status(404).json({ message: 'Request not found' });
    await audit(req, `timeoff_${status}`, 'TimeOffRequest', request._id, { status, employeeId: request.employee._id });

    const io = req.app.get('io');
    await notify(io, request.employee._id, {
      type: status === 'approved' ? 'timeoff_approved' : 'timeoff_denied',
      title: `Time Off ${status === 'approved' ? 'Approved' : 'Denied'}`,
      body: `Your time off request (${request.startDate} – ${request.endDate}) has been ${status}.`,
      link: '/',
    });
    res.json(request);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/timeoff/:id', auth, async (req, res) => {
  try {
    const request = await TimeOffRequest.findOne({ _id: req.params.id, employee: req.user._id, status: 'pending' });
    if (!request) return res.status(404).json({ message: 'Request not found or already reviewed' });
    await request.deleteOne();
    res.json({ message: 'Request deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Availability ──────────────────────────────────────────────────────────────

router.get('/availability', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = {};
    if (req.user.role === 'employee') query.employee = req.user._id;
    if (startDate && endDate) query.date = { $gte: startDate, $lte: endDate };
    const records = await Availability.find(query).populate('employee', 'name email color').sort({ date: 1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/availability', auth, async (req, res) => {
  try {
    const { date, startTime, endTime, notes } = req.body;
    const existing = await Availability.findOne({ employee: req.user._id, date });
    if (existing) return res.status(409).json({ message: 'Already marked available for this date' });
    const record = await Availability.create({ employee: req.user._id, date, startTime: startTime || '', endTime: endTime || '', notes: notes || '' });
    const populated = await record.populate('employee', 'name email color');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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

// ── Recurring Unavailability ──────────────────────────────────────────────────

router.get('/recurring-unavailability', auth, async (req, res) => {
  try {
    const query = ['admin', 'manager'].includes(req.user.role) ? {} : { employee: req.user._id };
    const records = await RecurringUnavailability.find(query).populate('employee', 'name color');
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/recurring-unavailability', auth, async (req, res) => {
  try {
    const { dayOfWeek, label } = req.body;
    const existing = await RecurringUnavailability.findOne({ employee: req.user._id, dayOfWeek });
    if (existing) return res.status(409).json({ message: 'Already marked unavailable for that day' });
    const record = await RecurringUnavailability.create({ employee: req.user._id, dayOfWeek, label: label || '' });
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/recurring-unavailability/:id', auth, async (req, res) => {
  try {
    const record = await RecurringUnavailability.findOne({ _id: req.params.id, employee: req.user._id });
    if (!record) return res.status(404).json({ message: 'Not found' });
    await record.deleteOne();
    res.json({ message: 'Removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Shift Exchange ────────────────────────────────────────────────────────────

const EXCHANGE_POPULATE = [
  { path: 'shift' },
  { path: 'requestedBy', select: 'name color position' },
  { path: 'acceptedBy', select: 'name color' },
  { path: 'responses.employee', select: 'name color position' },
];

router.get('/exchanges', auth, async (req, res) => {
  try {
    if (req.user.role === 'admin' || req.user.role === 'manager') {
      const exchanges = await ShiftExchange.find().populate(EXCHANGE_POPULATE).sort({ date: 1, createdAt: -1 });
      return res.json({ requests: exchanges, available: [] });
    }
    const requests = await ShiftExchange.find({ requestedBy: req.user._id }).populate(EXCHANGE_POPULATE).sort({ createdAt: -1 });
    const openQuery = { status: 'open', requestedBy: { $ne: req.user._id } };
    if (req.user.position) openQuery.position = req.user.position;
    let coverable = await ShiftExchange.find(openQuery).populate(EXCHANGE_POPULATE).sort({ date: 1 });
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

router.post('/exchanges', auth, async (req, res) => {
  try {
    const { shiftId, note } = req.body;
    const shift = await Shift.findById(shiftId);
    if (!shift) return res.status(404).json({ message: 'Shift not found' });
    if (shift.employee.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'You can only exchange your own shifts' });
    const existing = await ShiftExchange.findOne({ shift: shiftId, status: 'open' });
    if (existing) return res.status(409).json({ message: 'An open exchange request already exists for this shift' });
    const exchange = await ShiftExchange.create({ shift: shiftId, requestedBy: req.user._id, date: shift.date, position: shift.position || req.user.position || '', note: note || '' });
    const populated = await ShiftExchange.findById(exchange._id).populate(EXCHANGE_POPULATE);
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/exchanges/:id/respond', auth, async (req, res) => {
  try {
    const { response } = req.body;
    if (!['available', 'declined'].includes(response)) return res.status(400).json({ message: 'Invalid response' });
    const exchange = await ShiftExchange.findById(req.params.id);
    if (!exchange || exchange.status !== 'open') return res.status(400).json({ message: 'Exchange not available' });
    if (exchange.requestedBy.toString() === req.user._id.toString()) return res.status(400).json({ message: 'Cannot respond to your own request' });
    const idx = exchange.responses.findIndex((r) => r.employee.toString() === req.user._id.toString());
    if (idx >= 0) { exchange.responses[idx].response = response; exchange.responses[idx].respondedAt = new Date(); }
    else exchange.responses.push({ employee: req.user._id, response });
    await exchange.save();

    // Notify the requester
    const io = req.app.get('io');
    if (response === 'available') {
      await notify(io, exchange.requestedBy, {
        type: 'exchange_response',
        title: 'Someone can cover your shift',
        body: `${req.user.name} is available to cover your shift on ${exchange.date}.`,
        link: '/',
      });
    }

    const populated = await ShiftExchange.findById(exchange._id).populate(EXCHANGE_POPULATE);
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/exchanges/:id', auth, isAdmin, async (req, res) => {
  try {
    const { acceptedBy } = req.body;
    const exchange = await ShiftExchange.findById(req.params.id);
    if (!exchange || exchange.status !== 'open') return res.status(400).json({ message: 'Exchange not open' });
    await Shift.findByIdAndUpdate(exchange.shift, { employee: acceptedBy });
    exchange.acceptedBy = acceptedBy; exchange.status = 'approved';
    await exchange.save();

    const io = req.app.get('io');
    await notify(io, exchange.requestedBy, {
      type: 'exchange_approved',
      title: 'Shift Exchange Approved',
      body: `Your shift exchange request for ${exchange.date} has been approved.`,
      link: '/',
    });
    await notify(io, acceptedBy, {
      type: 'shift_assigned',
      title: 'Shift Exchange — You\'re Covering',
      body: `You have been assigned to cover a shift on ${exchange.date}.`,
      link: '/schedule',
    });

    const populated = await ShiftExchange.findById(exchange._id).populate(EXCHANGE_POPULATE);
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/exchanges/:id', auth, async (req, res) => {
  try {
    const exchange = await ShiftExchange.findOne({ _id: req.params.id, requestedBy: req.user._id, status: 'open' });
    if (!exchange) return res.status(404).json({ message: 'Not found or not cancellable' });
    exchange.status = 'cancelled';
    await exchange.save();
    res.json({ message: 'Exchange cancelled' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Audit Log (admin only) ────────────────────────────────────────────────────

const AuditLog = require('../models/AuditLog');

router.get('/audit', auth, async (req, res) => {
  try {
    if (!['admin', 'manager'].includes(req.user.role)) return res.status(403).json({ message: 'Access denied' });
    const { page = 1, limit = 50 } = req.query;
    const logs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await AuditLog.countDocuments();
    res.json({ logs, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
