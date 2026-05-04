const express = require('express');
const router = express.Router();
const Trip = require('../models/Trip');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { auth, requireOwner } = require('../middleware/auth');

// GET /api/trips
router.get('/', auth, async (req, res) => {
  try {
    const { status, from, to, page = 1, limit = 20 } = req.query;
    const filter = {};

    // Workers only see their own trips
    if (req.user.role === 'worker') {
      filter['crew.worker'] = req.user._id;
    }
    if (status) filter.status = status;
    if (from || to) {
      filter.departureDate = {};
      if (from) filter.departureDate.$gte = new Date(from);
      if (to) filter.departureDate.$lte = new Date(to);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [trips, total] = await Promise.all([
      Trip.find(filter)
        .populate('captain', 'name username')
        .populate('crew.worker', 'name username')
        .populate('createdBy', 'name')
        .sort({ departureDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Trip.countDocuments(filter)
    ]);

    res.json({ success: true, data: trips, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.', error: err.message });
  }
});

// GET /api/trips/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate('captain', 'name username phone')
      .populate('crew.worker', 'name username phone sharePercentage dailyWage')
      .populate('createdBy', 'name');

    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found.' });

    // Workers can only view their own trips
    if (req.user.role === 'worker') {
      const isCrew = trip.crew.some(c => c.worker._id.toString() === req.user._id.toString());
      if (!isCrew) return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.json({ success: true, data: trip });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/trips — Owner creates trip
router.post('/', auth, requireOwner, async (req, res) => {
  try {
    const { boat, departureDate, returnDate, captain, crew, location, notes } = req.body;

    if (!boat || !departureDate || !captain) {
      return res.status(400).json({ success: false, message: 'Boat, departure date, and captain are required.' });
    }

    // Enrich crew with their current wage/share settings
    let enrichedCrew = [];
    if (crew && crew.length > 0) {
      const workerIds = crew.map(c => c.worker);
      const workers = await User.find({ _id: { $in: workerIds } });
      enrichedCrew = crew.map(c => {
        const w = workers.find(u => u._id.toString() === c.worker);
        return {
          worker: c.worker,
          role: c.role || 'crew',
          sharePercentage: c.sharePercentage !== undefined ? c.sharePercentage : (w ? w.sharePercentage : 0),
          dailyWage: c.dailyWage !== undefined ? c.dailyWage : (w ? w.dailyWage : 0)
        };
      });
    }

    const trip = await Trip.create({
      boat, departureDate, returnDate, captain,
      crew: enrichedCrew,
      location, notes,
      status: 'planned',
      createdBy: req.user._id
    });

    res.status(201).json({ success: true, message: 'Trip created successfully.', data: trip });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.', error: err.message });
  }
});

// PUT /api/trips/:id — Update trip
router.put('/:id', auth, requireOwner, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found.' });
    if (trip.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot update a cancelled trip.' });
    }

    const allowedFields = ['boat', 'departureDate', 'returnDate', 'captain', 'crew', 'catchData', 'expenses', 'status', 'location', 'notes'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) trip[field] = req.body[field];
    });

    await trip.save();
    res.json({ success: true, message: 'Trip updated successfully.', data: trip });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.', error: err.message });
  }
});

// POST /api/trips/:id/complete — Mark trip complete and auto-generate payments
router.post('/:id/complete', auth, requireOwner, async (req, res) => {
  try {
    const { catchData, expenses, returnDate } = req.body;
    const trip = await Trip.findById(req.params.id).populate('crew.worker');

    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found.' });
    if (trip.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Trip already completed.' });
    }

    // Update trip data
    if (catchData) trip.catchData = catchData;
    if (expenses) trip.expenses = expenses;
    if (returnDate) trip.returnDate = new Date(returnDate);
    trip.status = 'completed';
    await trip.save();

    // Auto-generate payment records for each crew member
    const payments = [];
    for (const crewMember of trip.crew) {
      if (!crewMember.worker) continue;

      let amount = 0;
      let type = 'wage';

      if (crewMember.sharePercentage > 0) {
        amount = (trip.netRevenue * crewMember.sharePercentage) / 100;
        type = 'share';
      } else if (crewMember.dailyWage > 0) {
        const days = trip.returnDate
          ? Math.ceil((new Date(trip.returnDate) - new Date(trip.departureDate)) / (1000 * 60 * 60 * 24))
          : 1;
        amount = crewMember.dailyWage * Math.max(days, 1);
        type = 'wage';
      }

      if (amount > 0) {
        payments.push({
          worker: crewMember.worker._id,
          trip: trip._id,
          type,
          amount: Math.round(amount * 100) / 100,
          description: `Trip ${trip.tripNumber} - ${type === 'share' ? crewMember.sharePercentage + '% share' : 'Daily wage'}`,
          status: 'pending',
          requestedBy: req.user._id
        });
      }
    }

    if (payments.length > 0) {
      await Payment.insertMany(payments);
    }

    res.json({
      success: true,
      message: `Trip completed. ${payments.length} payment(s) generated for approval.`,
      data: trip,
      paymentsGenerated: payments.length
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.', error: err.message });
  }
});

// POST /api/trips/:id/update-catch — Add catch data and expenses for an active trip without completing it
router.post('/:id/update-catch', auth, requireOwner, async (req, res) => {
  try {
    const { catchData, expenses } = req.body;
    const trip = await Trip.findById(req.params.id);

    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found.' });
    if (trip.status === 'completed' || trip.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot update catch for completed or cancelled trips.' });
    }

    if (catchData) {
      trip.catchData = [...trip.catchData, ...catchData];
    }
    if (expenses) {
      trip.expenses = [...trip.expenses, ...expenses];
    }

    // Change status to active if it was planned
    if (trip.status === 'planned') trip.status = 'active';

    await trip.save();
    res.json({ success: true, message: 'Catch and expenses updated successfully.', data: trip });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.', error: err.message });
  }
});

// DELETE /api/trips/:id — Cancel trip
router.delete('/:id', auth, requireOwner, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found.' });
    trip.status = 'cancelled';
    await trip.save();
    res.json({ success: true, message: 'Trip cancelled.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
