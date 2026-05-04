require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('./config');

const app = express();

// ── Security Middleware ──────────────────────────────────────────────────────
// app.use(helmet({
//   contentSecurityPolicy: {
//     directives: {
//       defaultSrc: ["'self'"],
//       scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
//       scriptSrcAttr: ["'unsafe-inline'"],
//       styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdnjs.cloudflare.com"],
//       fontSrc: ["'self'", "fonts.gstatic.com", "cdnjs.cloudflare.com"],
//       imgSrc: ["'self'", "data:", "blob:"],
//       connectSrc: ["'self'", "fonts.googleapis.com", "fonts.gstatic.com", "cdnjs.cloudflare.com", "cdn.jsdelivr.net"]
//     }
//   }
// }));

app.use(cors({
  origin: config.env === 'production' ? process.env.ALLOWED_ORIGIN : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ── General Rate Limiting ────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Too many requests. Please try again later.' }
});
app.use('/api/', generalLimiter);

// ── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Debug Logger ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// ── Static Files (Frontend) ──────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

// ── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/trips', require('./routes/trips'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/reports', require('./routes/reports'));

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Fishing Boat Management API is running.',
    time: new Date().toISOString(),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// ── Catch-all: Serve SPA ─────────────────────────────────────────────────────
// Only serve index.html for routes that don't look like files (no dot in last segment)
app.get(/^[^\.]*$/, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Error Handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ── Database & Server Start ──────────────────────────────────────────────────
const startServer = async () => {
  try {
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✅ MongoDB connected:', config.mongoUri);

    // Seed default owner account if no users exist
    const User = require('./models/User');
    const count = await User.countDocuments();
    if (count === 0) {
      await User.create({
        name: 'Boat Owner',
        username: 'owner',
        pin: '1234',
        role: 'owner',
        preferredLanguage: 'en'
      });
      console.log('🌱 Default owner created: username=owner, PIN=1234');
      console.log('   ⚠️  IMPORTANT: Change the PIN after first login!');
    }
  } catch (err) {
    console.warn('⚠️  MongoDB not available, running without database:', err.message);
    console.warn('   Install MongoDB or provide a valid MONGODB_URI in .env');
  }

  app.listen(config.port, () => {
    console.log(`\n🚢 Fishing Boat Management System running!`);
    console.log(`📡 Server: http://localhost:${config.port}`);
    console.log(`🔐 Default login: username=owner, PIN=1234\n`);
  });
};

startServer();
