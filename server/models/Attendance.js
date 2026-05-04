const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['present', 'absent', 'half-day'], required: true },
  wageEarned: { type: Number, default: 0 },
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String, trim: true }
}, { timestamps: true });

// Ensure one record per worker per day
attendanceSchema.index({ date: 1, worker: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
