const router = require('express').Router();
const TimeCorrection = require('../models/TimeCorrection');
const { auth, isAdmin } = require('../middleware/auth');

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
    const { date, originalClockIn, originalClockOut, correctedClockIn, correctedClockOut, lunchOut, lunchIn, reason } =
      req.body;

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
