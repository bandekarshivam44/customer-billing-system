const mongoose = require("mongoose");

const paymentAllocationSchema = new mongoose.Schema(
  {
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },

    year: {
      type: Number,
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
  },
);

const paymentSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },

    // Actual amount received
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    addedBy: {
      type: String,
      enum: ["RAJESH", "SHIVAM"],
      required: true,
    },

    // Actual collection date
    paidAt: {
      type: Date,
      default: Date.now,
    },

    note: {
      type: String,
      trim: true,
      default: "",
    },

    // Where this payment was allocated
    allocations: {
      type: [paymentAllocationSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

paymentSchema.index({
  customer: 1,
  paidAt: -1,
});

module.exports = mongoose.model("Payment", paymentSchema);
