const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/**
 * Send a push notification to all subscriptions for the given userId.
 * @param {string} userId
 * @param {{ title: string, body: string, icon?: string, badge?: string, data?: object }} payload
 */
async function pushToUser(userId, payload) {
  const subs = await PushSubscription.find({ user: userId });
  const notification = JSON.stringify(payload);

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          notification
        );
      } catch (err) {
        // 410 Gone = subscription expired/unregistered — clean it up
        if (err.statusCode === 410 || err.statusCode === 404) {
          await PushSubscription.deleteOne({ _id: sub._id });
        }
      }
    })
  );
}

module.exports = { pushToUser };
