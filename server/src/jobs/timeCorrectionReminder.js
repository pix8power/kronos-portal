const cron = require('node-cron');
const User = require('../models/User');
const { sendPush } = require('../utils/sendPush');

// Runs every Friday at 8:00 AM server time.
// Sends every other Friday (biweekly) by tracking which week of the year it is.
function startTimeCorrectionReminderJob() {
  cron.schedule('0 8 * * 5', async () => {
    try {
      // Biweekly: only fire on even ISO week numbers
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const weekNumber = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
      if (weekNumber % 2 !== 0) return;

      const employees = await User.find({}, '_id');
      for (const emp of employees) {
        await sendPush(emp._id.toString(), {
          title: 'Time Correction Reminder',
          body: 'Reminder: submit any time corrections for this pay period by end of day.',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          data: { url: '/' },
        }).catch(() => {});
      }

      console.log(`[TimeCorrectionReminder] Sent to ${employees.length} users (week ${weekNumber})`);
    } catch (err) {
      console.error('Time correction reminder job error:', err.message);
    }
  });

  console.log('Time correction reminder job started (biweekly Fridays at 8 AM)');
}

module.exports = { startTimeCorrectionReminderJob };
