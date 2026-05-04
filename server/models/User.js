const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: 100
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true,
    maxlength: 50
  },
  pin: {
    type: String,
    required: [true, 'PIN is required'],
    minlength: 4,
    maxlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: ['owner', 'worker'],
    default: 'worker'
  },
  phone: {
    type: String,
    trim: true,
    maxlength: 15
  },
  address: {
    type: String,
    trim: true,
    maxlength: 200
  },
  joinDate: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  preferredLanguage: {
    type: String,
    enum: ['en', 'hi', 'kn'],
    default: 'en'
  },
  // Worker-specific fields
  dailyWage: {
    type: Number,
    default: 0
  },
  sharePercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  canMarkAttendance: {
    type: Boolean,
    default: false
  },
  advanceBalance: {
    type: Number,
    default: 0
  },
  profilePhoto: {
    type: String,
    default: null
  },
  refreshTokens: [{
    type: String,
    select: false
  }],
  lastLogin: Date,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Hash PIN before saving
userSchema.pre('save', async function () {
  if (!this.isModified('pin')) return;
  this.pin = await bcrypt.hash(this.pin, 12);
});

// Compare PIN
userSchema.methods.comparePin = async function (candidatePin) {
  return await bcrypt.compare(candidatePin, this.pin);
};

// Remove sensitive fields from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.pin;
  delete obj.refreshTokens;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
