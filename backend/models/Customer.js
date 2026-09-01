const mongoose = require("mongoose");

const packageHistorySchema = new mongoose.Schema(
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
  { _id: false },
);

const customerSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    nuid: {
      type: String,
      trim: true,
      default: "",
    },

    mobile: {
      type: String,
      trim: true,
      default: "",
    },

    packageAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    packageHistory: {
      type: [packageHistorySchema],
      default: [],
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },
    billingStartMonth: { type: Number, min: 1, max: 12, default: null },
    billingStartYear: { type: Number, default: null },
    currentBalance: { type: Number, default: 0 },
    balanceOverrides: [
      {
        month: { type: Number, required: true },
        year: { type: Number, required: true },
        type: { type: String, enum: ["add", "deduct"], required: true },
        amount: { type: Number, required: true, min: 0 },
        reason: { type: String, default: "" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    status: {
      type: String,
      enum: ["active", "inactive", "free"],
      default: "active",
    },
    statusHistory: [
      {
        month: Number,
        year: Number,
        status: { type: String, enum: ["active", "inactive", "free"] },
      },
    ],
    packageHistory: [{ month: Number, year: Number, amount: Number }],
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Customer", customerSchema);
