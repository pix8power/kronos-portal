require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const scheduleRoutes = require('./routes/schedules');
const messageRoutes = require('./routes/messages');
const timeCorrectionRoutes = require('./routes/timecorrections');
const masterScheduleRoutes = require('./routes/masterSchedule');
const notificationRoutes = require('./routes/notifications');
const pushRoutes = require('./routes/push');
const announcementRoutes = require('./routes/announcements');
const { initSocket } = require('./socket');
const { startShiftReminderJob } = require('./jobs/shiftReminders');
const { startExpiryReminderJob } = require('./jobs/expiryReminders');
const { startTimeCorrectionReminderJob } = require('./jobs/timeCorrectionReminder');

const corsOptions = {
  origin: true,
  credentials: true,
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { ...corsOptions, methods: ['GET', 'POST'] },
  maxHttpBufferSize: 5e6, // 5MB — needed for image messages
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 300 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts, please try again later.' },
});
app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/timecorrections', timeCorrectionRoutes);
app.use('/api/master-schedule', masterScheduleRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/open-shifts', require('./routes/openShifts'));
app.use('/api/recurring-shifts', require('./routes/recurringShifts'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/ical', require('./routes/ical'));
app.use('/api/webauthn', require('./routes/webauthn'));
app.use('/uploads', require('express').static(require('path').join(__dirname, '../uploads')));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/contact', async (req, res) => {
  try {
    const { sendContactForm } = require('./utils/email');
    await sendContactForm(req.body);
    res.json({ message: 'Sent' });
  } catch (err) {
    console.error('Contact form error:', err.message);
    res.json({ message: 'Received' });
  }
});

// Serve React client in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = require('path').join(__dirname, '../../client/dist');
  app.use(require('express').static(clientDist));
  app.get('*', (req, res) => res.sendFile(require('path').join(clientDist, 'index.html')));
}

// Make io accessible in routes via req.app.get('io')
app.set('io', io);

// Socket.io
initSocket(io);

// Start server immediately so healthcheck passes, then connect to MongoDB
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    startShiftReminderJob();
    startExpiryReminderJob();
    startTimeCorrectionReminderJob();
  })
  .catch((err) => console.error('MongoDB connection error:', err));
