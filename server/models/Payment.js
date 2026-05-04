const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  paymentNumber: {
    type: String,
    unique: true
  },
  worker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  trip: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip'
  },
  type: {
    type: String,
    enum: ['wage', 'share', 'advance', 'bonus', 'deduction', 'reversal'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    trim: true,
    maxlength: 200
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'paid', 'reversed'],
    default: 'pending'
  },
  // Approval workflow
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  approvalNotes: String,
  // Payment method
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'upi', 'other'],
    default: 'cash'
  },
  paidAt: Date,
  // Reversal tracking
  reversedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reversedAt: Date,
  reversalReason: String,
  originalPayment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  }
}, {
  timestamps: true
});

// Auto-generate payment number
paymentSchema.pre('save', async function () {
  if (this.isNew && !this.paymentNumber) {
    const count = await mongoose.model('Payment').countDocuments();
    this.paymentNumber = `PAY-${String(count + 1).padStart(5, '0')}`;
  }
});

module.exports = mongoose.model('Payment', paymentSchema);
