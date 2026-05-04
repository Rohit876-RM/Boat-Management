const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Payment = require('../models/Payment');
const { auth, requireOwner, requireAttendanceAuth } = require('../middleware/auth');

// GET /api/attendance?date=YYYY-MM-DD
router.get('/', auth, async (req, res) => {
  try {
    const { date, month } = req.query;
    let filter = {};

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    } else if (month) {
      const [year, m] = month.split('-');
      const start = new Date(year, parseInt(m) - 1, 1);
      const end = new Date(year, parseInt(m), 0, 23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filter.date = { $gte: today };
    }

    if (req.user.role === 'worker') {
      filter.worker = req.user._id;
    }

    const records = await Attendance.find(filter).populate('worker', 'name username dailyWage');
    res.json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.', error: err.message });
  }
});

// POST /api/attendance
// Body: { date: 'YYYY-MM-DD', records: [{ worker: id, status: 'present'/'absent'/'half-day' }] }
router.post('/', auth, requireAttendanceAuth, async (req, res) => {
  try {
    const { date, records } = req.body;
    if (!date || !records || !Array.isArray(records)) {
      return res.status(400).json({ success: false, message: 'Invalid data format.' });
    }

    const targetDate = new Date(date);
    targetDate.setHours(12, 0, 0, 0); // Noon to avoid timezone issues

    // Fetch workers to get daily wage
    const workerIds = records.map(r => r.worker);
    const workers = await User.find({ _id: { $in: workerIds } });

    const bulkOps = records.map(r => {
      const w = workers.find(x => x._id.toString() === r.worker);
      let wageEarned = 0;
      if (w && w.dailyWage) {
        if (r.status === 'present') wageEarned = w.dailyWage;
        if (r.status === 'half-day') wageEarned = w.dailyWage / 2;
      }

      return {
        updateOne: {
          filter: {
            date: {
              $gte: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0),
              $lte: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59)
            },
            worker: r.worker
          },
          update: {
            $set: {
              date: targetDate,
              worker: r.worker,
              status: r.status,
              wageEarned,
              markedBy: req.user._id
            }
          },
          upsert: true
        }
      };
    });

    if (bulkOps.length > 0) {
      await Attendance.bulkWrite(bulkOps);
    }

    // Process wages to Payments if configured to generate daily
    for (const r of records) {
      const w = workers.find(x => x._id.toString() === r.worker);
      let wageEarned = 0;
      if (w && w.dailyWage) {
        if (r.status === 'present') wageEarned = w.dailyWage;
        if (r.status === 'half-day') wageEarned = w.dailyWage / 2;
      }

      // Find if an attendance payment for this specific date and worker already exists
      const desc = `Daily Wage - ${date}`;
      if (wageEarned > 0) {
        await Payment.updateOne(
          { worker: r.worker, description: desc, type: 'wage', status: 'pending' },
          { $set: { amount: wageEarned, requestedBy: req.user._id } },
          { upsert: true }
        );
      } else {
        // If absent, remove any pending wage payment for this day
        await Payment.deleteOne({ worker: r.worker, description: desc, type: 'wage', status: 'pending' });
      }
    }

    res.json({ success: true, message: 'Attendance saved successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.', error: err.message });
  }
});

module.exports = router;
