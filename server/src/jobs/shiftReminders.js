const cron = require('node-cron');
const Shift = require('../models/Shift');
const { sendPush } = require('../utils/sendPush');

// Runs every 15 minutes — sends reminders for shifts starting in ~60 minutes
function startShiftReminderJob() {
  cron.schedule('*/15 * * * *', async () => {
    try {
      const now = new Date();
      const targetMin = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

      const padded = (n) => String(n).padStart(2, '0');
      const todayStr = `${now.getFullYear()}-${padded(now.getMonth() + 1)}-${padded(now.getDate())}`;

      // Window: shifts starting between 55–65 min from now
      const windowStart = new Date(now.getTime() + 55 * 60 * 1000);
      const windowEnd   = new Date(now.getTime() + 65 * 60 * 1000);
      const toTime = (d) => `${padded(d.getHours())}:${padded(d.getMinutes())}`;

      const shifts = await Shift.find({
        date: todayStr,
        startTime: { $gte: toTime(windowStart), $lte: toTime(windowEnd) },
        status: { $in: ['scheduled', 'confirmed'] },
      }).populate('employee', 'name');

      for (const shift of shifts) {
        if (!shift.employee?._id) continue;
        await sendPush(shift.employee._id.toString(), {
          title: 'Shift Reminder',
          body: `Your shift starts at ${shift.startTime} today. Get ready!`,
          data: { url: '/schedule' },
        });
      }
    } catch (err) {
      console.error('Shift reminder job error:', err.message);
    }
  });

  console.log('Shift reminder job started');
}

module.exports = { startShiftReminderJob };
