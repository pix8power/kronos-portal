const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { sendPush } = require('../utils/sendPush');

const EXPIRY_THRESHOLD_DAYS = 42; // if renewed beyond this, cancel notices

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr + 'T00:00:00') - new Date(new Date().toDateString());
  return Math.round(diff / 86400000);
}

// Returns credential items that were previously within warning range but are now renewed
function findRenewedCredentials(oldUser, updates) {
  const renewed = [];

  const wasExpiring = (days) => days !== null && days <= EXPIRY_THRESHOLD_DAYS;
  const isNowSafe   = (days) => days !== null && days > EXPIRY_THRESHOLD_DAYS;

  // License
  if (updates.licenseExpiry !== undefined) {
    const oldDays = daysUntil(oldUser.licenseExpiry);
    const newDays = daysUntil(updates.licenseExpiry);
    if (wasExpiring(oldDays) && isNowSafe(newDays)) {
      renewed.push('License');
    }
  }

  // BLS/CPR
  if (updates.blsCprExpiry !== undefined) {
    const oldDays = daysUntil(oldUser.blsCprExpiry);
    const newDays = daysUntil(updates.blsCprExpiry);
    if (wasExpiring(oldDays) && isNowSafe(newDays)) {
      renewed.push('BLS/CPR');
    }
  }

  // Certifications — match by name
  if (updates.certifications !== undefined) {
    const oldCerts = oldUser.certifications || [];
    for (const newCert of updates.certifications) {
      const oldCert = oldCerts.find((c) => c.name === newCert.name);
      if (!oldCert) continue;
      const oldDays = daysUntil(oldCert.expiry);
      const newDays = daysUntil(newCert.expiry);
      if (wasExpiring(oldDays) && isNowSafe(newDays)) {
        renewed.push(newCert.name);
      }
    }
  }

  return renewed;
}

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.user._id}-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// GET own profile (extended)
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET any user's profile (privileged or self)
router.get('/:id', auth, async (req, res) => {
  const PRIVILEGED = ['admin', 'manager', 'charge_nurse'];
  if (req.params.id !== req.user._id.toString() && !PRIVILEGED.includes(req.user.role))
    return res.status(403).json({ message: 'Forbidden' });
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'Not found' });
    res.json(user);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PATCH update profile fields
router.patch('/', auth, async (req, res) => {
  const allowed = ['bio', 'hireDate', 'seniorityDate', 'licenseNumber', 'licenseExpiry', 'blsCprExpiry', 'certifications', 'phone'];
  const updates = {};
  for (const key of allowed) { if (req.body[key] !== undefined) updates[key] = req.body[key]; }
  try {
    const oldUser = await User.findById(req.user._id);
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');

    // If any credentials were renewed, send confirmation push to staff + managers
    const renewed = findRenewedCredentials(oldUser, updates);
    if (renewed.length > 0) {
      const label = renewed.join(', ');
      await sendPush(req.user._id.toString(), {
        title: '✅ Credential Renewal Confirmed',
        body: `Your ${label} has been updated. No further expiry reminders will be sent.`,
        data: { url: '/profile' },
      });

      const MANAGER_ROLES = ['admin', 'manager', 'charge_nurse'];
      const managers = await User.find({ role: { $in: MANAGER_ROLES } }).select('_id');
      for (const mgr of managers) {
        if (mgr._id.toString() === req.user._id.toString()) continue;
        await sendPush(mgr._id.toString(), {
          title: '✅ Staff Credential Renewed',
          body: `${oldUser.name}'s ${label} has been renewed. Expiry reminders cancelled.`,
          data: { url: `/profile/${req.user._id}` },
        });
      }
    }

    res.json(user);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST upload document
router.post('/documents', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  try {
    const doc = { name: req.body.name || req.file.originalname, filename: req.file.filename };
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $push: { documents: doc } },
      { new: true }
    ).select('-password');
    res.json(user);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE document
router.delete('/documents/:filename', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const doc = user.documents.find((d) => d.filename === req.params.filename);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    const filePath = path.join(UPLOADS_DIR, req.params.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await User.findByIdAndUpdate(req.user._id, { $pull: { documents: { filename: req.params.filename } } });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET download a document
router.get('/documents/:filename', auth, async (req, res) => {
  try {
    const user = await User.findOne({ 'documents.filename': req.params.filename });
    const PRIVILEGED = ['admin', 'manager', 'charge_nurse'];
    if (!user || (user._id.toString() !== req.user._id.toString() && !PRIVILEGED.includes(req.user.role)))
      return res.status(403).json({ message: 'Forbidden' });
    res.sendFile(path.join(UPLOADS_DIR, req.params.filename));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET iCal token for current user
router.get('/ical-token', auth, async (req, res) => {
  const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, { expiresIn: '1y' });
  res.json({ token });
});

module.exports = router;
