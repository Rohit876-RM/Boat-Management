const express = require('express');
const router = express.Router();
const Trip = require('../models/Trip');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { auth, requireOwner } = require('../middleware/auth');

// GET /api/reports/summary — Business summary dashboard
router.get('/summary', auth, requireOwner, async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFilter = {};
    if (from || to) {
      dateFilter.createdAt = {};
      if (from) dateFilter.createdAt.$gte = new Date(from);
      if (to) dateFilter.createdAt.$lte = new Date(to);
    }

    const [
      totalWorkers,
      activeWorkers,
      totalTrips,
      completedTrips,
      allTrips,
      pendingPayments,
      approvedPayments,
      paidPayments
    ] = await Promise.all([
      User.countDocuments({ role: 'worker' }),
      User.countDocuments({ role: 'worker', isActive: true }),
      Trip.countDocuments(),
      Trip.countDocuments({ status: 'completed' }),
      Trip.find({ status: 'completed', ...dateFilter }),
      Payment.find({ status: 'pending', ...dateFilter }),
      Payment.find({ status: 'approved', ...dateFilter }),
      Payment.find({ status: 'paid', ...dateFilter })
    ]);

    const totalRevenue = allTrips.reduce((s, t) => s + (t.grossRevenue || 0), 0);
    const totalExpenses = allTrips.reduce((s, t) => s + (t.totalExpenses || 0), 0);
    const netProfit = totalRevenue - totalExpenses;
    const totalCatch = allTrips.reduce((s, t) => s + (t.totalCatch || 0), 0);

    const pendingAmount = pendingPayments.reduce((s, p) => s + p.amount, 0);
    const approvedAmount = approvedPayments.reduce((s, p) => s + p.amount, 0);
    const paidAmount = paidPayments.reduce((s, p) => s + p.amount, 0);

    res.json({
      success: true,
      data: {
        workers: { total: totalWorkers, active: activeWorkers },
        trips: { total: totalTrips, completed: completedTrips },
        financials: {
          totalRevenue, totalExpenses, netProfit, totalCatch,
          avgRevenuePerTrip: completedTrips > 0 ? totalRevenue / completedTrips : 0
        },
        payments: {
          pending: { count: pendingPayments.length, amount: pendingAmount },
          approved: { count: approvedPayments.length, amount: approvedAmount },
          paid: { count: paidPayments.length, amount: paidAmount }
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.', error: err.message });
  }
});

// GET /api/reports/monthly — Monthly breakdown
router.get('/monthly', auth, requireOwner, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const trips = await Trip.aggregate([
      {
        $match: {
          status: 'completed',
          departureDate: {
            $gte: new Date(`${year}-01-01`),
            $lte: new Date(`${year}-12-31`)
          }
        }
      },
      {
        $group: {
          _id: { $month: '$departureDate' },
          revenue: { $sum: '$grossRevenue' },
          expenses: { $sum: '$totalExpenses' },
          netProfit: { $sum: '$netRevenue' },
          totalCatch: { $sum: '$totalCatch' },
          tripCount: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    const months = Array.from({ length: 12 }, (_, i) => {
      const found = trips.find(t => t._id === i + 1);
      return {
        month: i + 1,
        revenue: found ? found.revenue : 0,
        expenses: found ? found.expenses : 0,
        netProfit: found ? found.netProfit : 0,
        totalCatch: found ? found.totalCatch : 0,
        tripCount: found ? found.tripCount : 0
      };
    });

    res.json({ success: true, data: months });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/reports/worker/:id — Worker earnings report
router.get('/worker/:id', auth, async (req, res) => {
  try {
    // Workers can only see their own report
    if (req.user.role === 'worker' && req.params.id !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const worker = await User.findById(req.params.id);
    if (!worker) return res.status(404).json({ success: false, message: 'Worker not found.' });

    const payments = await Payment.find({ worker: req.params.id })
      .populate('trip', 'tripNumber boat departureDate returnDate')
      .sort({ createdAt: -1 });

    const summary = {
      totalEarned: 0, totalAdvance: 0, totalPaid: 0, pendingAmount: 0, tripCount: 0
    };

    const tripIds = new Set();
    payments.forEach(p => {
      if (p.trip) tripIds.add(p.trip._id.toString());
      if (['wage', 'share', 'bonus'].includes(p.type) && p.status === 'paid') {
        summary.totalEarned += p.amount;
        summary.totalPaid += p.amount;
      }
      if (p.type === 'advance' && p.status === 'paid') {
        summary.totalAdvance += p.amount;
        summary.totalPaid += p.amount;
      }
      if (p.status === 'pending') summary.pendingAmount += p.amount;
    });
    summary.tripCount = tripIds.size;
    summary.netBalance = summary.totalEarned - summary.totalAdvance;

    res.json({ success: true, data: { worker, payments, summary } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/reports/fish-types — Fish catch breakdown
router.get('/fish-types', auth, requireOwner, async (req, res) => {
  try {
    const fishData = await Trip.aggregate([
      { $match: { status: 'completed' } },
      { $unwind: '$catchData' },
      {
        $group: {
          _id: '$catchData.fishType',
          totalQuantity: { $sum: '$catchData.quantity' },
          totalValue: { $sum: '$catchData.totalValue' },
          avgPrice: { $avg: '$catchData.pricePerKg' },
          tripCount: { $sum: 1 }
        }
      },
      { $sort: { totalValue: -1 } }
    ]);

    res.json({ success: true, data: fishData });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/reports/audit — Audit log (owner only)
const AuditLog = require('../models/AuditLog');
router.get('/audit', auth, requireOwner, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
      AuditLog.find().sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).populate('user', 'name username'),
      AuditLog.countDocuments()
    ]);
    res.json({ success: true, data: logs, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
