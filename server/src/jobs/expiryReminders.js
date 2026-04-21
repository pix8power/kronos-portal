const cron = require('node-cron');
const User = require('../models/User');
const { sendPush } = require('../utils/sendPush');

const MANAGER_ROLES = ['admin', 'manager', 'charge_nurse'];

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr + 'T00:00:00') - new Date(new Date().toDateString());
  return Math.round(diff / 86400000);
}

// Runs daily at 8 AM
function startExpiryReminderJob() {
  cron.schedule('0 8 * * *', async () => {
    try {
      const users = await User.find({});
      const managers = users.filter((u) => MANAGER_ROLES.includes(u.role));

      for (const user of users) {
        const items = [
          { label: 'License', expiry: user.licenseExpiry, number: user.licenseNumber },
          { label: 'BLS/CPR', expiry: user.blsCprExpiry },
          ...(user.certifications || []).map((c) => ({ label: c.name, expiry: c.expiry, number: c.number })),
        ].filter((item) => item.expiry);

        for (const item of items) {
          const days = daysUntil(item.expiry);
          if (days === null) continue;

          const label = item.label + (item.number ? ` (${item.number})` : '');

          if (days === 42) {
            // 6 weeks — staff only
            await sendPush(user._id.toString(), {
              title: '📋 Credential Expiry Reminder',
              body: `Your ${label} expires in 6 weeks (${item.expiry}). Time to start renewal!`,
              data: { url: '/profile' },
            });
          } else if (days === 28) {
            // 4 weeks — staff only
            await sendPush(user._id.toString(), {
              title: '📋 Credential Expiry Reminder',
              body: `Your ${label} expires in 4 weeks (${item.expiry}). Please begin the renewal process.`,
              data: { url: '/profile' },
            });
          } else if (days === 14) {
            // 2 weeks — staff only
            await sendPush(user._id.toString(), {
              title: '⚠️ Credential Expiry — 2 Weeks',
              body: `Your ${label} expires in 2 weeks (${item.expiry}). Please renew soon.`,
              data: { url: '/profile' },
            });
          } else if (days === 7) {
            // 1 week — staff + managers
            await sendPush(user._id.toString(), {
              title: '🚨 Credential Expiring in 1 Week',
              body: `Your ${label} expires on ${item.expiry}. Renew immediately.`,
              data: { url: '/profile' },
            });
            for (const mgr of managers) {
              if (mgr._id.toString() === user._id.toString()) continue;
              await sendPush(mgr._id.toString(), {
                title: '🚨 Staff Credential Expiring',
                body: `${user.name}'s ${label} expires in 7 days (${item.expiry}).`,
                data: { url: `/profile/${user._id}` },
              });
            }
          } else if (days === 1) {
            // 1 day — staff + managers
            await sendPush(user._id.toString(), {
              title: '🚨 Credential Expires Tomorrow',
              body: `Your ${label} expires TOMORROW (${item.expiry}). Renew immediately!`,
              data: { url: '/profile' },
            });
            for (const mgr of managers) {
              if (mgr._id.toString() === user._id.toString()) continue;
              await sendPush(mgr._id.toString(), {
                title: '🚨 Staff Credential Expires Tomorrow',
                body: `${user.name}'s ${label} expires TOMORROW (${item.expiry}).`,
                data: { url: `/profile/${user._id}` },
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('Expiry reminder job error:', err.message);
    }
  });

  console.log('Expiry reminder job started');
}

module.exports = { startExpiryReminderJob };
