const router = require('express').Router();
const User = require('../models/User');
const { auth, isAdmin } = require('../middleware/auth');

// Get all users
// Admins see everyone.
// Managers see users from all departments in their departments[] array (or everyone if none set).
// Others see only their own department.
router.get('/', auth, async (req, res) => {
  try {
    const { role, department, departments = [] } = req.user;
    let filter = {};

    if (role === 'admin') {
      filter = {}; // all users
    } else if (role === 'manager') {
      if (departments.length > 0) {
        filter = { department: { $in: departments } };
      }
      // if no departments configured yet, fall through with empty filter (see all)
    } else {
      // charge_nurse / employee — own department only
      if (department) {
        filter = { department };
      } else {
        filter = { _id: req.user._id };
      }
    }

    const users = await User.find(filter).select('-password').sort({ name: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Search users across all departments (for messaging)
router.get('/search', auth, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);
    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { position: { $regex: q, $options: 'i' } },
        { department: { $regex: q, $options: 'i' } },
      ],
    })
      .select('-password')
      .sort({ name: 1 })
      .limit(20);
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get user by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update user profile
router.put('/:id', auth, async (req, res) => {
  try {
    const isSelf = req.user._id.toString() === req.params.id;
    const isPrivileged = ['admin', 'manager'].includes(req.user.role);
    if (!isSelf && !isPrivileged) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const { name, position, department, departments, phone, color, avatar } = req.body;
    const update = { name, position, department, phone, color, avatar };
    if (Array.isArray(departments)) update.departments = departments;
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: update role
router.patch('/:id/role', auth, isAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role: req.body.role },
      { new: true }
    ).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: delete user
router.delete('/:id', auth, isAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
