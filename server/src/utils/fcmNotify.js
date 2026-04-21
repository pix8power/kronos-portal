const admin = require('firebase-admin');
const FcmToken = require('../models/FcmToken');

let initialized = false;

function getApp() {
  if (initialized) return admin.app();

  const projectId     = process.env.FIREBASE_PROJECT_ID;
  const clientEmail   = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey    = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) return null;

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
  initialized = true;
  return admin.app();
}

/**
 * Send an FCM notification to all registered devices for a user.
 * @param {string} userId
 * @param {{ title: string, body: string, data?: Record<string,string> }} payload
 */
async function fcmToUser(userId, { title, body, data = {} }) {
  const app = getApp();
  if (!app) return; // Firebase not configured yet

  const tokens = await FcmToken.find({ user: userId }).select('token');
  if (!tokens.length) return;

  const stringData = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, String(v)])
  );

  const message = {
    notification: { title, body },
    data: stringData,
    android: {
      priority: 'high',
      ttl: 86400,
      notification: {
        sound: 'default',
        channelId: 'default',
        notificationPriority: 'PRIORITY_MAX',
        visibility: 'PUBLIC',
        defaultVibrateTimings: true,
        defaultSound: true,
      },
    },
  };

  await Promise.allSettled(
    tokens.map(async ({ token }) => {
      try {
        await app.messaging().send({ ...message, token });
      } catch (err) {
        // invalid/expired token — remove it
        if (err.code === 'messaging/registration-token-not-registered' ||
            err.code === 'messaging/invalid-registration-token') {
          await FcmToken.deleteOne({ token });
        }
      }
    })
  );
}

module.exports = { fcmToUser };
