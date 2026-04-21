const router = require('express').Router();
const ical = require('ical-generator');
const User = require('../models/User');
const Shift = require('../models/Shift');
const jwt = require('jsonwebtoken');

// GET /api/ical/:token — returns iCal feed (no auth middleware, uses token in URL)
router.get('/:token', async (req, res) => {
  try {
    let userId;
    try {
      const decoded = jwt.verify(req.params.token, process.env.JWT_SECRET);
      userId = decoded.id;
    } catch {
      return res.status(401).send('Invalid or expired token');
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).send('User not found');

    const now = new Date();
    const past = new Date(now); past.setMonth(now.getMonth() - 3);
    const future = new Date(now); future.setMonth(now.getMonth() + 3);
    const fmt = (d) => d.toISOString().slice(0, 10);

    const shifts = await Shift.find({
      employee: userId,
      date: { $gte: fmt(past), $lte: fmt(future) },
      status: { $ne: 'cancelled' },
    });

    const cal = ical.default({ name: `KronosPortal — ${user.name}` });

    for (const shift of shifts) {
      const [sy, sm, sd] = shift.date.split('-').map(Number);
      const [sh, smin] = shift.startTime.split(':').map(Number);
      const [eh, emin] = shift.endTime.split(':').map(Number);
      const start = new Date(sy, sm - 1, sd, sh, smin);
      const end   = new Date(sy, sm - 1, sd, eh, emin);
      cal.createEvent({
        start,
        end,
        summary: `Shift${shift.position ? ` · ${shift.position}` : ''}`,
        description: shift.notes || '',
        location: shift.department || '',
      });
    }

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="schedule.ics"');
    res.send(cal.toString());
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;
