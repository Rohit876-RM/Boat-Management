const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Payment = require('../models/Payment');
const { auth, requireOwner } = require('../middleware/auth');

// GET /api/users — Owner/Worker gets all workers
router.get('/', auth, async (req, res) => {
  try {
    const { role, isActive, search } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter).sort({ name: 1 });
    res.json({ success: true, data: users, count: users.length });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/users/me — Get own profile
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Get payment summary for worker
    let paymentSummary = null;
    if (user.role === 'worker') {
      const payments = await Payment.find({ worker: user._id, status: { $in: ['approved', 'paid'] } });
      const totalEarned = payments.filter(p => ['wage', 'share', 'bonus'].includes(p.type))
        .reduce((s, p) => s + p.amount, 0);
      const totalAdvance = payments.filter(p => p.type === 'advance')
        .reduce((s, p) => s + p.amount, 0);
      paymentSummary = { totalEarned, totalAdvance, netBalance: totalEarned - totalAdvance };
    }

    res.json({ success: true, data: user, paymentSummary });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/users/:id
router.get('/:id', auth, requireOwner, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/users — Owner creates a worker
router.post('/', auth, requireOwner, async (req, res) => {
  try {
    const { name, username, pin, phone, address, dailyWage, sharePercentage, preferredLanguage, canMarkAttendance } = req.body;

    if (!name || !username || !pin) {
      return res.status(400).json({ success: false, message: 'Name, username, and PIN are required.' });
    }

    const existing = await User.findOne({ username: username.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Username already exists.' });
    }

    const user = await User.create({
      name, username, pin, phone, address,
      dailyWage: dailyWage || 0,
      sharePercentage: sharePercentage || 0,
      canMarkAttendance: !!canMarkAttendance,
      preferredLanguage: preferredLanguage || 'en',
      role: 'worker',
      createdBy: req.user._id
    });

    res.status(201).json({ success: true, message: 'Worker created successfully.', data: user });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Username already exists.' });
    }
    res.status(500).json({ success: false, message: 'Server error.', error: err.message });
  }
});

// PUT /api/users/:id — Owner updates worker
router.put('/:id', auth, requireOwner, async (req, res) => {
  try {
    const { name, phone, address, dailyWage, sharePercentage, isActive, preferredLanguage, pin, canMarkAttendance } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (dailyWage !== undefined) updateData.dailyWage = dailyWage;
    if (sharePercentage !== undefined) updateData.sharePercentage = sharePercentage;
    if (canMarkAttendance !== undefined) updateData.canMarkAttendance = canMarkAttendance;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (preferredLanguage !== undefined) updateData.preferredLanguage = preferredLanguage;

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // Update PIN separately to trigger hashing
    if (pin) {
      user.pin = pin;
      await user.save();
    }

    Object.assign(user, updateData);
    await user.save();

    res.json({ success: true, message: 'Worker updated successfully.', data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE /api/users/:id — Soft delete (deactivate)
router.delete('/:id', auth, requireOwner, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (user.role === 'owner') {
      return res.status(400).json({ success: false, message: 'Cannot delete owner account.' });
    }
    user.isActive = false;
    await user.save();
    res.json({ success: true, message: 'Worker deactivated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PATCH /api/users/me/language
router.patch('/me/language', auth, async (req, res) => {
  try {
    const { language } = req.body;
    if (!['en', 'hi', 'kn'].includes(language)) {
      return res.status(400).json({ success: false, message: 'Invalid language.' });
    }
    await User.findByIdAndUpdate(req.user._id, { preferredLanguage: language });
    res.json({ success: true, message: 'Language updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
