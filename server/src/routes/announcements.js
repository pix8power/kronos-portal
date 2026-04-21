const router = require('express').Router();
const Announcement = require('../models/Announcement');
const User = require('../models/User');
const { auth, requireRole } = require('../middleware/auth');
const { sendPush } = require('../utils/sendPush');

const PRIVILEGED = ['admin', 'manager', 'charge_nurse'];

// GET all announcements visible to this user
router.get('/', auth, async (req, res) => {
  try {
    const announcements = await Announcement.find({
      $or: [{ targetRoles: { $size: 0 } }, { targetRoles: req.user.role }],
    })
      .populate('createdBy', 'name color')
      .sort({ pinned: -1, createdAt: -1 })
      .limit(50);
    res.json(announcements);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create announcement (privileged only)
router.post('/', auth, async (req, res) => {
  if (!PRIVILEGED.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
  try {
    const { title, body, targetRoles = [], pinned = false } = req.body;
    if (!title || !body) return res.status(400).json({ message: 'Title and body required' });

    const ann = await Announcement.create({ title, body, createdBy: req.user._id, targetRoles, pinned });
    await ann.populate('createdBy', 'name color');

    // Push to targeted users
    const roleFilter = targetRoles.length > 0 ? { role: { $in: targetRoles } } : {};
    const users = await User.find(roleFilter, '_id');
    for (const u of users) {
      if (u._id.toString() === req.user._id.toString()) continue;
      sendPush(u._id.toString(), {
        title: `📢 ${title}`,
        body,
        data: { url: '/' },
      }).catch(() => {});
    }

    res.status(201).json(ann);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH pin/unpin
router.patch('/:id/pin', auth, async (req, res) => {
  if (!PRIVILEGED.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
  try {
    const ann = await Announcement.findByIdAndUpdate(req.params.id, { pinned: req.body.pinned }, { new: true }).populate('createdBy', 'name color');
    if (!ann) return res.status(404).json({ message: 'Not found' });
    res.json(ann);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE
router.delete('/:id', auth, async (req, res) => {
  if (!PRIVILEGED.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
  try {
    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
