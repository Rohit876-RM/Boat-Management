const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const User = require('../models/User');
const { auth, requireOwner } = require('../middleware/auth');

// GET /api/payments
router.get('/', auth, async (req, res) => {
  try {
    const { status, type, worker, from, to, page = 1, limit = 20 } = req.query;
    const filter = {};

    // Workers see only their own payments
    if (req.user.role === 'worker') {
      filter.worker = req.user._id;
    } else if (worker) {
      filter.worker = worker;
    }

    if (status) filter.status = status;
    if (type) filter.type = type;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate('worker', 'name username phone')
        .populate('trip', 'tripNumber boat departureDate')
        .populate('approvedBy', 'name')
        .populate('requestedBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Payment.countDocuments(filter)
    ]);

    res.json({ success: true, data: payments, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/payments/pending-count
router.get('/pending-count', auth, requireOwner, async (req, res) => {
  try {
    const count = await Payment.countDocuments({ status: 'pending' });
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/payments/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('worker', 'name username phone')
      .populate('trip', 'tripNumber boat departureDate')
      .populate('approvedBy', 'name')
      .populate('requestedBy', 'name')
      .populate('reversedBy', 'name');

    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found.' });

    if (req.user.role === 'worker' && payment.worker._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.json({ success: true, data: payment });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/payments — Create a payment (e.g. advance request)
router.post('/', auth, async (req, res) => {
  try {
    const { worker, trip, type, amount, description, paymentMethod } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount is required.' });
    }

    // Workers can only create advance requests for themselves
    let workerId = worker;
    if (req.user.role === 'worker') {
      if (type !== 'advance') {
        return res.status(403).json({ success: false, message: 'Workers can only request advances.' });
      }
      workerId = req.user._id;
    }

    if (!workerId) {
      return res.status(400).json({ success: false, message: 'Worker is required.' });
    }

    const payment = await Payment.create({
      worker: workerId, trip, type: type || 'advance', amount, description,
      paymentMethod: paymentMethod || 'cash',
      status: 'pending',
      requestedBy: req.user._id
    });

    res.status(201).json({ success: true, message: 'Payment request created.', data: payment });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.', error: err.message });
  }
});

// POST /api/payments/:id/approve — Owner approves payment
router.post('/:id/approve', auth, requireOwner, async (req, res) => {
  try {
    const { notes } = req.body;
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found.' });
    if (payment.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Payment is already ${payment.status}.` });
    }

    payment.status = 'approved';
    payment.approvedBy = req.user._id;
    payment.approvedAt = new Date();
    payment.approvalNotes = notes;
    await payment.save();

    res.json({ success: true, message: 'Payment approved.', data: payment });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/payments/:id/reject — Owner rejects payment
router.post('/:id/reject', auth, requireOwner, async (req, res) => {
  try {
    const { notes } = req.body;
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found.' });
    if (payment.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Payment is already ${payment.status}.` });
    }

    payment.status = 'rejected';
    payment.approvedBy = req.user._id;
    payment.approvedAt = new Date();
    payment.approvalNotes = notes;
    await payment.save();

    res.json({ success: true, message: 'Payment rejected.', data: payment });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/payments/:id/pay — Mark as paid
router.post('/:id/pay', auth, requireOwner, async (req, res) => {
  try {
    const { paymentMethod } = req.body;
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found.' });
    if (payment.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Payment must be approved before marking as paid.' });
    }

    payment.status = 'paid';
    payment.paidAt = new Date();
    if (paymentMethod) payment.paymentMethod = paymentMethod;

    // Update worker's advance balance if this is an advance
    if (payment.type === 'advance') {
      await User.findByIdAndUpdate(payment.worker, { $inc: { advanceBalance: payment.amount } });
    }

    await payment.save();
    res.json({ success: true, message: 'Payment marked as paid.', data: payment });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/payments/:id/reverse — Reverse a paid payment
router.post('/:id/reverse', auth, requireOwner, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'Reversal reason is required.' });

    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found.' });
    if (payment.status !== 'paid') {
      return res.status(400).json({ success: false, message: 'Only paid payments can be reversed.' });
    }

    // Create reversal record
    const reversal = await Payment.create({
      worker: payment.worker,
      trip: payment.trip,
      type: 'reversal',
      amount: payment.amount,
      description: `Reversal of ${payment.paymentNumber}: ${reason}`,
      status: 'paid',
      requestedBy: req.user._id,
      approvedBy: req.user._id,
      approvedAt: new Date(),
      paidAt: new Date(),
      originalPayment: payment._id
    });

    payment.status = 'reversed';
    payment.reversedBy = req.user._id;
    payment.reversedAt = new Date();
    payment.reversalReason = reason;
    await payment.save();

    res.json({ success: true, message: 'Payment reversed.', data: reversal });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/payments/bulk-approve — Bulk approve multiple payments
router.post('/bulk-approve', auth, requireOwner, async (req, res) => {
  try {
    const { paymentIds, notes } = req.body;
    if (!paymentIds || !Array.isArray(paymentIds) || paymentIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Payment IDs array is required.' });
    }

    const result = await Payment.updateMany(
      { _id: { $in: paymentIds }, status: 'pending' },
      {
        status: 'approved',
        approvedBy: req.user._id,
        approvedAt: new Date(),
        approvalNotes: notes || 'Bulk approved'
      }
    );

    res.json({ success: true, message: `${result.modifiedCount} payment(s) approved.`, modified: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
