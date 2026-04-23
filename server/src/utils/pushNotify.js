const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

let vapidInitialized = false;

function initVapid() {
  if (vapidInitialized) return true;
  const { VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!VAPID_EMAIL || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidInitialized = true;
  return true;
}

async function pushToUser(userId, payload) {
  if (!initVapid()) return;
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
        if (err.statusCode === 410 || err.statusCode === 404) {
          await PushSubscription.deleteOne({ _id: sub._id });
        }
      }
    })
  );
}

module.exports = { pushToUser };
