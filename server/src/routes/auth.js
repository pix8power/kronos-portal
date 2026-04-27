const router = require('express').Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { sendPasswordReset } = require('../utils/email');

const MAX_ATTEMPTS = 3;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, position, department, phone, color } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already in use' });

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'employee',
      position: position || '',
      department: department || '',
      phone: phone || '',
      color: color || '#3B82F6',
      mustChangePassword: true,
    });

    const token = signToken(user._id);
    res.status(201).json({ token, user: user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal whether the email exists
      return res.status(400).json({ message: 'Invalid credentials', attemptsLeft: MAX_ATTEMPTS });
    }

    // Check if account is temporarily locked
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({
        message: `Account temporarily locked. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`,
        locked: true,
        lockUntil: user.lockUntil,
      });
    }

    const valid = await user.comparePassword(password);

    if (!valid) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      const attemptsLeft = Math.max(0, MAX_ATTEMPTS - user.loginAttempts);

      if (user.loginAttempts >= MAX_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
        await user.save();
        return res.status(423).json({
          message: 'Too many failed attempts. Account locked for 15 minutes.',
          locked: true,
          attemptsLeft: 0,
          lockUntil: user.lockUntil,
        });
      }

      await user.save();
      return res.status(400).json({
        message: 'Invalid credentials',
        attemptsLeft,
      });
    }

    // Successful login — reset attempt counter
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    user.isOnline = true;
    user.lastLogin = new Date();
    await user.save();

    const token = signToken(user._id);
    res.json({ token, user: user.toSafeObject(), mustChangePassword: user.mustChangePassword });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Forgot password — sends reset email
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If that email is registered, a reset link has been sent.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetUrl = `${clientUrl}/reset-password/${token}`;

    try {
      await sendPasswordReset(user.email, user.name, resetUrl);
    } catch (emailErr) {
      console.error('Email send failed:', emailErr.message);
      // Still respond — but include the link in dev mode so it's testable
      if (process.env.NODE_ENV !== 'production') {
        return res.json({
          message: 'Reset link generated (email not configured — see devResetUrl).',
          devResetUrl: resetUrl,
        });
      }
      return res.status(500).json({ message: 'Failed to send email. Contact your administrator.' });
    }

    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Reset password — validates token and sets new password
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Reset link is invalid or has expired.' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Force change password on first login
router.post('/change-password-first', auth, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }
    const user = await User.findById(req.user._id);
    user.password = password;
    user.mustChangePassword = false;
    await user.save();
    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  res.json({ user: req.user });
});

// Logout
router.post('/logout', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      isOnline: false,
      lastSeen: new Date(),
    });
    res.json({ message: 'Logged out' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
