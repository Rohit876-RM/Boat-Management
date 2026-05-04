const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');
const config = require('../config');
const rateLimit = require('express-rate-limit');

// Rate limit: max 10 login attempts per 15 min per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please wait 15 minutes.' }
});

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
  const refreshToken = jwt.sign({ id: userId }, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpiresIn });
  return { accessToken, refreshToken };
};

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, pin } = req.body;
    if (!username || !pin) {
      return res.status(400).json({ success: false, message: 'Username and PIN are required.' });
    }

    const user = await User.findOne({ username: username.toLowerCase(), isActive: true }).select('+pin');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const isMatch = await user.comparePin(pin);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const { accessToken, refreshToken } = generateTokens(user._id);

    // Store refresh token
    await User.findByIdAndUpdate(user._id, {
      $push: { refreshTokens: refreshToken },
      lastLogin: new Date()
    });

    const userObj = user.toJSON();

    res.json({
      success: true,
      message: 'Login successful.',
      accessToken,
      refreshToken,
      user: userObj
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token required.' });
    }

    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
    const user = await User.findById(decoded.id).select('+refreshTokens');

    if (!user || !user.isActive || !user.refreshTokens.includes(refreshToken)) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token.' });
    }

    const { accessToken, refreshToken: newRefresh } = generateTokens(user._id);

    // Rotate refresh token
    await User.findByIdAndUpdate(user._id, {
      $pull: { refreshTokens: refreshToken },
      $push: { refreshTokens: newRefresh }
    });

    res.json({ success: true, accessToken, refreshToken: newRefresh });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
      await User.findByIdAndUpdate(decoded.id, {
        $pull: { refreshTokens: refreshToken }
      });
    }
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    res.json({ success: true, message: 'Logged out.' });
  }
});

// POST /api/auth/change-pin
const { auth } = require('../middleware/auth');
router.post('/change-pin', auth, async (req, res) => {
  try {
    const { currentPin, newPin } = req.body;
    if (!currentPin || !newPin || newPin.length < 4) {
      return res.status(400).json({ success: false, message: 'Current PIN and new PIN (min 4 digits) required.' });
    }

    const user = await User.findById(req.user._id).select('+pin');
    const isMatch = await user.comparePin(currentPin);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current PIN is incorrect.' });
    }

    user.pin = newPin;
    await user.save();

    res.json({ success: true, message: 'PIN changed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
