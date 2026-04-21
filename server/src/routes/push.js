const router = require('express').Router();
const PushSubscription = require('../models/PushSubscription');
const FcmToken = require('../models/FcmToken');
const { auth } = require('../middleware/auth');

// GET public VAPID key (no auth needed)
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// POST save a push subscription
router.post('/subscribe', auth, async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ message: 'Invalid subscription object' });
    }

    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { user: req.user._id, endpoint, keys },
      { upsert: true, new: true }
    );

    res.json({ message: 'Subscribed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE remove a push subscription
router.delete('/unsubscribe', auth, async (req, res) => {
  try {
    const { endpoint } = req.body;
    await PushSubscription.deleteOne({ endpoint, user: req.user._id });
    res.json({ message: 'Unsubscribed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST register an FCM device token (Capacitor Android/iOS)
router.post('/fcm-token', auth, async (req, res) => {
  try {
    const { token, platform } = req.body;
    if (!token) return res.status(400).json({ message: 'Token required' });

    await FcmToken.findOneAndUpdate(
      { token },
      { user: req.user._id, token, platform: platform || 'android' },
      { upsert: true, new: true }
    );

    res.json({ message: 'FCM token registered' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE remove an FCM token on logout
router.delete('/fcm-token', auth, async (req, res) => {
  try {
    const { token } = req.body;
    await FcmToken.deleteOne({ token, user: req.user._id });
    res.json({ message: 'FCM token removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
