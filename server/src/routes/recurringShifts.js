const router = require('express').Router();
const RecurringShift = require('../models/RecurringShift');
const Shift = require('../models/Shift');
const { auth } = require('../middleware/auth');

const PRIVILEGED = ['admin', 'manager', 'charge_nurse'];

const addDays = (dateStr, n) => {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

// GET all recurring shifts (admin sees all, employee sees own)
router.get('/', auth, async (req, res) => {
  try {
    const filter = PRIVILEGED.includes(req.user.role) ? {} : { employee: req.user._id };
    const shifts = await RecurringShift.find({ ...filter, active: true })
      .populate('employee', 'name color position')
      .sort({ dayOfWeek: 1, startTime: 1 });
    res.json(shifts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create recurring shift
router.post('/', auth, async (req, res) => {
  if (!PRIVILEGED.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
  try {
    const shift = await RecurringShift.create({ ...req.body, createdBy: req.user._id });
    await shift.populate('employee', 'name color position');
    res.status(201).json(shift);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST generate shifts for a date range
router.post('/generate', auth, async (req, res) => {
  if (!PRIVILEGED.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
  try {
    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) return res.status(400).json({ message: 'startDate and endDate required' });

    const patterns = await RecurringShift.find({ active: true });
    const created = [];
    const skipped = [];

    for (const pattern of patterns) {
      let cursor = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T00:00:00');
      const step = pattern.interval === 'biweekly' ? 14 : 7;

      // Align cursor to first matching dayOfWeek >= startDate
      while (cursor.getDay() !== pattern.dayOfWeek) cursor.setDate(cursor.getDate() + 1);

      // Skip weeks for biweekly: find the correct phase from pattern.startDate
      if (pattern.interval === 'biweekly') {
        const patternStart = new Date(pattern.startDate + 'T00:00:00');
        // Align patternStart to correct DOW
        while (patternStart.getDay() !== pattern.dayOfWeek) patternStart.setDate(patternStart.getDate() + 1);
        const diffMs = cursor - patternStart;
        const diffWeeks = Math.round(diffMs / (7 * 86400000));
        if (diffWeeks % 2 !== 0) cursor.setDate(cursor.getDate() + 7); // shift to correct phase
      }

      while (cursor <= end) {
        const dateStr = cursor.toISOString().slice(0, 10);
        if (pattern.endDate && dateStr > pattern.endDate) break;
        if (dateStr < pattern.startDate) { cursor.setDate(cursor.getDate() + step); continue; }

        const exists = await Shift.findOne({ employee: pattern.employee, date: dateStr, startTime: pattern.startTime });
        if (!exists) {
          const s = await Shift.create({
            employee: pattern.employee,
            date: dateStr,
            startTime: pattern.startTime,
            endTime: pattern.endTime,
            position: pattern.position,
            department: pattern.department,
            createdBy: req.user._id,
          });
          created.push(s);
        } else {
          skipped.push(dateStr);
        }
        cursor.setDate(cursor.getDate() + step);
      }
    }

    res.json({ created: created.length, skipped: skipped.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE / deactivate
router.delete('/:id', auth, async (req, res) => {
  if (!PRIVILEGED.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
  try {
    await RecurringShift.findByIdAndUpdate(req.params.id, { active: false });
    res.json({ message: 'Deactivated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
