const Payment = require("../models/Payment");
const Customer = require("../models/Customer");
const { recalcCustomerBalance } = require("./paymentController");

const validCollectors = ["RAJESH", "SHIVAM"];
const Location = require("../models/Location");
// Device sends its queued actions here
const pushChanges = async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const results = [];

  for (const item of items) {
    try {
      if (item.type !== "PAYMENT_CREATE") {
        results.push({ seq: item.seq, status: "rejected", error: "Unknown action" });
        continue;
      }

      const p = item.payload || {};
      const alloc = (p.allocations || [])[0] || {};
      const amount = Number(p.amount);
      const month = Number(alloc.month);
      const year = Number(alloc.year);
      const collector = String(p.addedBy || "").trim().toUpperCase();
      const paidAt = new Date(p.paidAt);

      // Same validation as your addPayment
      let error = null;
      if (!p.clientId) error = "Missing clientId";
      else if (!Number.isFinite(amount) || amount <= 0) error = "Amount must be greater than 0";
      else if (!Number.isInteger(month) || month < 1 || month > 12) error = "Invalid month";
      else if (!Number.isInteger(year) || year < 2000) error = "Invalid year";
      else if (!validCollectors.includes(collector)) error = "Invalid collector";
      else if (Number.isNaN(paidAt.getTime())) error = "Invalid payment date";

      if (error) {
        results.push({ seq: item.seq, status: "rejected", error });
        continue;
      }

      const customer = await Customer.findById(p.customer);
      if (!customer) {
        results.push({ seq: item.seq, status: "rejected", error: "Customer not found" });
        continue;
      }

      // Idempotent: if this clientId already exists, a retry must not create a duplicate
      const existing = await Payment.findOne({ clientId: p.clientId }).select("_id");
      if (existing) {
        results.push({ seq: item.seq, status: "ok" });
        continue;
      }

      await Payment.create({
        clientId: p.clientId,
        customer: customer._id,
        amount,
        addedBy: collector,
        paidAt,
        note: p.note ? String(p.note).trim() : "",
        allocations: [{ month, year, amount }],
      });

      await recalcCustomerBalance(customer._id);
      results.push({ seq: item.seq, status: "ok" });
    } catch (err) {
      if (err && err.code === 11000) {
        // unique clientId collision = already saved
        results.push({ seq: item.seq, status: "ok" });
      } else {
        console.error("SYNC PUSH ERROR:", err);
        results.push({ seq: item.seq, status: "retry" }); // temporary problem, keep in queue
      }
    }
  }

  res.json({ success: true, results });
};

const pullChanges = async (req, res) => {
  try {
    const serverTime = Date.now();
    const sinceValue = Number(req.query.since) || 0;
    const isInitialSync = sinceValue <= 0;

    const customerFilter = isInitialSync
      ? {}
      : { updatedAt: { $gt: new Date(sinceValue) } };

    const paymentFilter = isInitialSync
      ? {}
      : { updatedAt: { $gt: new Date(sinceValue) } };

    const [
      customers,
      payments,
      locations,
      customerIds,
      paymentIds,
    ] = await Promise.all([
      Customer.find(customerFilter)
        .populate("location", "name")
        .lean(),

      Payment.find(paymentFilter)
        .lean(),

      Location.find({}).lean(),

      Customer.find({})
        .select("_id")
        .lean(),

      Payment.find({})
        .select("_id")
        .lean(),
    ]);

    return res.json({
      success: true,
      serverTime,
      customers,
      payments,
      locations,
      customerIds: customerIds.map((c) => String(c._id)),
      paymentIds: paymentIds.map((p) => String(p._id)),
    });
  } catch (err) {
    console.error("SYNC PULL ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Pull failed",
    });
  }
};

module.exports = { pushChanges, pullChanges };