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
    clientId: {
      type: String,
      unique: true,
      sparse: true,   
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
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
  updatedAt: 1,
});

module.exports = mongoose.model("Payment", paymentSchema);
