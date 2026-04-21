const { pushToUser } = require('./pushNotify');
const { fcmToUser } = require('./fcmNotify');

/**
 * Send a push notification via both Web Push (browser PWA) and FCM (Capacitor).
 * Failures in either channel are silently swallowed — notifications are best-effort.
 */
async function sendPush(userId, { title, body, icon = '/icon-192.png', badge = '/icon-192.png', data = {} }) {
  const id = userId.toString();
  await Promise.allSettled([
    pushToUser(id, { title, body, icon, badge, data }),
    fcmToUser(id, { title, body, data }),
  ]);
}

module.exports = { sendPush };
