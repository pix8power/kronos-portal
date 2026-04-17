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
const { initSocket } = require('./socket');

// Allowed origins: web dev, Capacitor Android (http://localhost), Capacitor iOS (capacitor://localhost)
const ALLOWED_ORIGINS = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
  'ionic://localhost',
];

// Also allow any private-network IP (192.168.x.x, 10.x.x.x, 172.16-31.x.x) for local testing
const LOCAL_NETWORK_RE = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/;

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin || ALLOWED_ORIGINS.includes(origin) || LOCAL_NETWORK_RE.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { ...corsOptions, methods: ['GET', 'POST'] },
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
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

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Make io accessible in routes via req.app.get('io')
app.set('io', io);

// Socket.io
initSocket(io);

// MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.error('MongoDB connection error:', err));
