require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Shift = require('../models/Shift');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

const COLORS = [
  '#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899',
  '#06B6D4','#84CC16','#F97316','#6366F1','#14B8A6','#E11D48',
  '#7C3AED','#0EA5E9','#D97706','#059669','#DC2626','#0891B2',
  '#7C3AED','#BE185D','#B45309','#15803D','#1D4ED8','#9333EA',
  '#0F766E','#C2410C','#4338CA','#0369A1','#6D28D9','#047857',
  '#B91C1C','#1E40AF','#92400E','#065F46',
];

const DEPTS = ['WCR', 'ONC'];
function dept(i) { return DEPTS[i % 2]; }

function randDate(startYear, endYear) {
  const start = new Date(`${startYear}-01-01`).getTime();
  const end   = new Date(`${endYear}-12-31`).getTime();
  return new Date(start + Math.random() * (end - start)).toISOString().slice(0, 10);
}

// Get Monday of week offset, return all 7 days
function weekDates(offsetWeeks = 0) {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7) + offsetWeeks * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

// Pick n unique random items from array
function pickN(arr, n) {
  const copy = [...arr].sort(() => Math.random() - 0.5);
  return copy.slice(0, n);
}

// ── User definitions ──────────────────────────────────────────────────────────
// shift: null = no scheduled shifts (manager/charge), else { start, end }
const SHIFT_DAY  = { start: '07:00', end: '15:30' };
const SHIFT_EVE  = { start: '15:00', end: '23:30' };
const SHIFT_NGT  = { start: '23:00', end: '07:30' };

const USERS = [
  // Manager
  { name: 'Sandra Lee',        email: 'manager@kronosportal.net',  role: 'manager',      position: 'Nurse Manager',     shift: null,      depts: ['WCR','ONC'] },
  // Charge RN
  { name: 'Diana Cruz',        email: 'charge@kronosportal.net',   role: 'charge_nurse', position: 'Charge RN',         shift: SHIFT_DAY, depts: [] },

  // RNs — Day 07:00–15:30
  { name: 'Marcus Johnson',    email: 'rn.day1@wcronc.net',        role: 'employee',     position: 'RN',                shift: SHIFT_DAY, depts: [] },
  { name: 'Yvonne Patel',      email: 'rn.day2@wcronc.net',        role: 'employee',     position: 'RN',                shift: SHIFT_DAY, depts: [] },
  { name: 'Carlos Mendez',     email: 'rn.day3@wcronc.net',        role: 'employee',     position: 'RN',                shift: SHIFT_DAY, depts: [] },
  { name: 'Aisha Thompson',    email: 'rn.day4@wcronc.net',        role: 'employee',     position: 'RN',                shift: SHIFT_DAY, depts: [] },
  { name: 'Kevin Park',        email: 'rn.day5@wcronc.net',        role: 'employee',     position: 'RN',                shift: SHIFT_DAY, depts: [] },
  { name: 'Rachel Greene',     email: 'rn.day6@wcronc.net',        role: 'employee',     position: 'RN',                shift: SHIFT_DAY, depts: [] },
  { name: 'Thomas Brown',      email: 'rn.day7@wcronc.net',        role: 'employee',     position: 'RN',                shift: SHIFT_DAY, depts: [] },

  // RNs — Evening 15:00–23:30
  { name: 'Jennifer Davis',    email: 'rn.eve1@wcronc.net',        role: 'employee',     position: 'RN',                shift: SHIFT_EVE, depts: [] },
  { name: 'Michael Wilson',    email: 'rn.eve2@wcronc.net',        role: 'employee',     position: 'RN',                shift: SHIFT_EVE, depts: [] },
  { name: 'Lisa Martinez',     email: 'rn.eve3@wcronc.net',        role: 'employee',     position: 'RN',                shift: SHIFT_EVE, depts: [] },
  { name: 'David Garcia',      email: 'rn.eve4@wcronc.net',        role: 'employee',     position: 'RN',                shift: SHIFT_EVE, depts: [] },
  { name: 'Sarah Anderson',    email: 'rn.eve5@wcronc.net',        role: 'employee',     position: 'RN',                shift: SHIFT_EVE, depts: [] },
  { name: 'James Taylor',      email: 'rn.eve6@wcronc.net',        role: 'employee',     position: 'RN',                shift: SHIFT_EVE, depts: [] },
  { name: 'Maria Rodriguez',   email: 'rn.eve7@wcronc.net',        role: 'employee',     position: 'RN',                shift: SHIFT_EVE, depts: [] },

  // RNs — Night 23:00–07:30
  { name: 'Robert Jackson',    email: 'rn.ngt1@wcronc.net',        role: 'employee',     position: 'RN',                shift: SHIFT_NGT, depts: [] },
  { name: 'Patricia White',    email: 'rn.ngt2@wcronc.net',        role: 'employee',     position: 'RN',                shift: SHIFT_NGT, depts: [] },
  { name: 'Christopher Harris',email: 'rn.ngt3@wcronc.net',        role: 'employee',     position: 'RN',                shift: SHIFT_NGT, depts: [] },
  { name: 'Linda Martin',      email: 'rn.ngt4@wcronc.net',        role: 'employee',     position: 'RN',                shift: SHIFT_NGT, depts: [] },
  { name: 'Daniel Thompson',   email: 'rn.ngt5@wcronc.net',        role: 'employee',     position: 'RN',                shift: SHIFT_NGT, depts: [] },
  { name: 'Barbara Moore',     email: 'rn.ngt6@wcronc.net',        role: 'employee',     position: 'RN',                shift: SHIFT_NGT, depts: [] },
  { name: 'Steven Clark',      email: 'rn.ngt7@wcronc.net',        role: 'employee',     position: 'RN',                shift: SHIFT_NGT, depts: [] },

  // LVNs — 1 per shift, then 2 extras spread across day/eve
  { name: 'Brenda Nguyen',     email: 'lvn.day1@wcronc.net',       role: 'employee',     position: 'LVN',               shift: SHIFT_DAY, depts: [] },
  { name: 'Fatima Hassan',     email: 'lvn.day2@wcronc.net',       role: 'employee',     position: 'LVN',               shift: SHIFT_DAY, depts: [] },
  { name: 'Tyrone Williams',   email: 'lvn.eve1@wcronc.net',       role: 'employee',     position: 'LVN',               shift: SHIFT_EVE, depts: [] },
  { name: 'Derek Owens',       email: 'lvn.eve2@wcronc.net',       role: 'employee',     position: 'LVN',               shift: SHIFT_EVE, depts: [] },
  { name: 'Rosa Gutierrez',    email: 'lvn.ngt1@wcronc.net',       role: 'employee',     position: 'LVN',               shift: SHIFT_NGT, depts: [] },

  // MAs — 2 per shift
  { name: 'James Kim',         email: 'ma.day1@wcronc.net',        role: 'employee',     position: 'Medical Assistant', shift: SHIFT_DAY, depts: [] },
  { name: 'Angela Scott',      email: 'ma.day2@wcronc.net',        role: 'employee',     position: 'Medical Assistant', shift: SHIFT_DAY, depts: [] },
  { name: 'Robert Torres',     email: 'ma.eve1@wcronc.net',        role: 'employee',     position: 'Medical Assistant', shift: SHIFT_EVE, depts: [] },
  { name: 'Linda Chen',        email: 'ma.eve2@wcronc.net',        role: 'employee',     position: 'Medical Assistant', shift: SHIFT_EVE, depts: [] },
  { name: 'Victor Reyes',      email: 'ma.ngt1@wcronc.net',        role: 'employee',     position: 'Medical Assistant', shift: SHIFT_NGT, depts: [] },
  { name: 'Maya Johnson',      email: 'ma.ngt2@wcronc.net',        role: 'employee',     position: 'Medical Assistant', shift: SHIFT_NGT, depts: [] },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  const [du, ds, dm, dc] = await Promise.all([
    User.deleteMany({}),
    Shift.deleteMany({}),
    Message.deleteMany({}),
    Conversation.deleteMany({}),
  ]);
  console.log(`Cleared: ${du.deletedCount} users, ${ds.deletedCount} shifts, ${dm.deletedCount} messages, ${dc.deletedCount} conversations\n`);

  // Create users
  const created = [];
  for (let i = 0; i < USERS.length; i++) {
    const u = USERS[i];
    const department = dept(i);
    const user = await User.create({
      name:          u.name,
      email:         u.email,
      password:      'Kronos2024!',
      role:          u.role,
      position:      u.position,
      department,
      departments:   u.depts.length ? u.depts : [department],
      color:         COLORS[i % COLORS.length],
      seniorityDate: randDate(1999, 2024),
      hireDate:      randDate(1999, 2024),
    });
    created.push({ user, shiftDef: u.shift });

    const shiftLabel = u.shift ? `${u.shift.start}–${u.shift.end}` : 'no shifts';
    console.log(`  ✅ ${u.role.padEnd(12)} ${u.name.padEnd(24)} ${department}  [${shiftLabel}]  seniority: ${user.seniorityDate}`);
  }

  // Manager is createdBy for all shifts
  const manager = created[0].user;

  // Generate 4 weeks of shifts per person
  console.log('\n  Generating shifts...\n');
  let totalShifts = 0;
  const DAYS_PER_WEEK = 5; // work 5 days out of 7

  for (const { user, shiftDef } of created) {
    if (!shiftDef) continue;
    for (let w = 0; w < 4; w++) {
      const dates = weekDates(w);
      const workDays = pickN(dates, DAYS_PER_WEEK);
      const shifts = workDays.map((date) => ({
        employee:   user._id,
        date,
        startTime:  shiftDef.start,
        endTime:    shiftDef.end,
        position:   user.position,
        department: user.department,
        status:     'scheduled',
        createdBy:  manager._id,
      }));
      await Shift.insertMany(shifts);
      totalShifts += shifts.length;
    }
  }

  console.log(`✅ ${created.length} users created`);
  console.log(`✅ ${totalShifts} shifts generated (4 weeks, 5 days/week per person)`);
  console.log('\n  Password: Kronos2024!');
  console.log('\n  Shift groups:');
  console.log('    Day   07:00–15:30 → 1 Charge RN + 7 RN + 2 LVN + 2 MA');
  console.log('    Eve   15:00–23:30 → 7 RN + 2 LVN + 2 MA');
  console.log('    Night 23:00–07:30 → 7 RN + 1 LVN + 2 MA\n');

  await mongoose.disconnect();
}

seed().catch((err) => { console.error(err); process.exit(1); });
