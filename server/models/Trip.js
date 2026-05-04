const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema({
  tripNumber: {
    type: String,
    unique: true
  },
  boat: {
    type: String,
    required: [true, 'Boat name is required'],
    trim: true
  },
  departureDate: {
    type: Date,
    required: [true, 'Departure date is required']
  },
  returnDate: {
    type: Date
  },
  captain: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  crew: [{
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['captain', 'crew', 'helper'],
      default: 'crew'
    },
    sharePercentage: {
      type: Number,
      default: 0
    },
    dailyWage: {
      type: Number,
      default: 0
    }
  }],
  catchData: [{
    fishType: String,
    quantity: Number, // in kg
    pricePerKg: Number,
    totalValue: Number
  }],
  totalCatch: {
    type: Number,
    default: 0 // in kg
  },
  grossRevenue: {
    type: Number,
    default: 0
  },
  expenses: [{
    category: {
      type: String,
      enum: ['fuel', 'ice', 'food', 'maintenance', 'port_fee', 'other']
    },
    description: String,
    amount: Number
  }],
  totalExpenses: {
    type: Number,
    default: 0
  },
  netRevenue: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['planned', 'active', 'completed', 'cancelled'],
    default: 'planned'
  },
  location: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Auto-generate trip number
tripSchema.pre('save', async function () {
  if (this.isNew && !this.tripNumber) {
    const count = await mongoose.model('Trip').countDocuments();
    this.tripNumber = `TRIP-${String(count + 1).padStart(4, '0')}`;
  }
  // Recalculate totals
  if (this.catchData && this.catchData.length > 0) {
    this.grossRevenue = this.catchData.reduce((s, c) => s + (c.totalValue || 0), 0);
    this.totalCatch = this.catchData.reduce((s, c) => s + (c.quantity || 0), 0);
  }
  if (this.expenses && this.expenses.length > 0) {
    this.totalExpenses = this.expenses.reduce((s, e) => s + (e.amount || 0), 0);
  }
  this.netRevenue = this.grossRevenue - this.totalExpenses;
});

module.exports = mongoose.model('Trip', tripSchema);
