const Notification = require('../models/Notification');

/**
 * Create a notification and emit it over Socket.io to the user's personal room.
 * @param {object} io       - Socket.io server instance
 * @param {string} userId   - recipient user ID
 * @param {object} payload  - { type, title, body, link, data }
 */
async function notify(io, userId, payload) {
  try {
    const notif = await Notification.create({ user: userId, ...payload });
    if (io) {
      io.to(userId.toString()).emit('notification', notif);
    }
    return notif;
  } catch {
    // Don't break the caller
  }
}

module.exports = { notify };
