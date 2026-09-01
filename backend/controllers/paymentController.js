const Payment = require("../models/Payment");
const Customer = require("../models/Customer");

const validCollectors = ["RAJESH", "SHIVAM"];

// ============================
// HELPERS
// ============================

const getMonthKey = (month, year) => Number(year) * 12 + Number(month);

const getPackageForMonth = (customer, month, year) => {
  const targetKey = getMonthKey(month, year);
  let pkg = Number(customer.packageAmount || 0);
  const history = [...(customer.packageHistory || [])].sort(
    (a, b) => getMonthKey(a.month, a.year) - getMonthKey(b.month, b.year),
  );
  for (const h of history) {
    if (getMonthKey(h.month, h.year) <= targetKey) pkg = Number(h.amount || 0);
  }
  return pkg;
};

const getBillingStart = (customer) => {
  if (customer.billingStartMonth && customer.billingStartYear) {
    return { month: Number(customer.billingStartMonth), year: Number(customer.billingStartYear) };
  }
  const d = new Date(customer.createdAt || Date.now());
  return { month: d.getMonth() + 1, year: d.getFullYear() };
};

// Total package amount owed from billing start through target month (inclusive)
const cumulativeDue = (customer, targetMonth, targetYear) => {
  const start = getBillingStart(customer);
  const targetKey = getMonthKey(targetMonth, targetYear);
  let due = 0;
  let m = start.month, y = start.year;
  while (getMonthKey(m, y) <= targetKey) {
    due += getPackageForMonth(customer, m, y);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return due;
};

// Total paid, using the REAL payment date (paidAt), through end of target month
const cumulativePaid = (payments, targetMonth, targetYear) => {
  const cutoff = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999); // last instant of target month
  return payments
    .filter((p) => new Date(p.paidAt) <= cutoff)
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
};

const getBalanceOverride = (customer, month, year) => {
  const list = customer.balanceOverrides || [];
  const targetKey = getMonthKey(month, year);
  let best = null;
  for (const o of list) {
    const k = getMonthKey(o.month, o.year);
    if (k <= targetKey && (!best || k > getMonthKey(best.month, best.year))) best = o;
  }
  return best;
};

const cumulativeDueFrom = (customer, fromM, fromY, toM, toY) => {
  let due = 0, m = fromM, y = fromY;
  while (getMonthKey(m, y) <= getMonthKey(toM, toY)) {
    due += getPackageForMonth(customer, m, y);
    m++; if (m > 12) { m = 1; y++; }
  }
  return due;
};

const getMonthBalance = (customer, payments, month, year) => {
  const override = getBalanceOverride(customer, month, year);
  let base = 0, startM, startY, cutoff;

  if (override) {
    if (override.month === month && override.year === year) {
      return Math.max(0, Number(override.balance || 0));
    }
    base = Number(override.balance || 0);
    startM = override.month + 1; startY = override.year;
    if (startM > 12) { startM = 1; startY++; }
    cutoff = new Date(override.year, override.month, 1);
  } else {
    const s = getBillingStart(customer);
    startM = s.month; startY = s.year;
    cutoff = new Date(0);
  }

  const due = base + cumulativeDueFrom(customer, startM, startY, month, year);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const paid = payments
    .filter((p) => new Date(p.paidAt) >= cutoff && new Date(p.paidAt) <= monthEnd)
    .reduce((s, p) => s + Number(p.amount || 0), 0);

  return Math.max(0, due - paid);
};

// Builds a full month-by-month ledger for the UI table
const buildBillingMonths = (customer, payments, startMonth, startYear, endMonth, endYear) => {
  const months = [];
  let m = Number(startMonth), y = Number(startYear);

  while (getMonthKey(m, y) <= getMonthKey(endMonth, endYear)) {
    const pkg = getPackageForMonth(customer, m, y);
    const due = cumulativeDue(customer, m, y);
    const paidToDate = cumulativePaid(payments, m, y);
    const balance = Math.max(0, due - paidToDate);

    const paidThisMonth = payments
      .filter((p) => {
        const d = new Date(p.paidAt);
        return d.getMonth() + 1 === m && d.getFullYear() === y;
      })
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    months.push({ month: m, year: y, package: pkg, paid: paidThisMonth, due, balance });

    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
};

const recalcCustomerBalance = async (customerId) => {
  const customer = await Customer.findById(customerId);
  if (!customer) return 0;

  const payments = await Payment.find({ customer: customerId }).lean();
  const now = new Date();
  const balance = getMonthBalance(customer, payments, now.getMonth() + 1, now.getFullYear());

  await Customer.findByIdAndUpdate(customerId, { currentBalance: balance });
  return balance;
};

// ============================
// ADD PAYMENT
// ============================

const addPayment = async (req, res) => {
  try {
    const { customer, amount, addedBy, note, paidAt, month, year } = req.body;

    if (!customer || amount === undefined || !addedBy || month === undefined || year === undefined) {
      return res.status(400).json({ success: false, message: "Customer, amount, payment collector, month and year are required" });
    }

    const numericMonth = Number(month);
    const numericYear = Number(year);
    const numericAmount = Number(amount);
    const collector = String(addedBy).trim().toUpperCase();

    if (!Number.isInteger(numericMonth) || numericMonth < 1 || numericMonth > 12) {
      return res.status(400).json({ success: false, message: "Invalid payment month" });
    }
    if (!Number.isInteger(numericYear) || numericYear < 2000) {
      return res.status(400).json({ success: false, message: "Invalid payment year" });
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: "Payment amount must be greater than 0" });
    }
    if (!validCollectors.includes(collector)) {
      return res.status(400).json({ success: false, message: `Invalid payment collector. Allowed collectors: ${validCollectors.join(", ")}` });
    }

    const customerExists = await Customer.findById(customer);
    if (!customerExists) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    const paymentDate = paidAt ? new Date(paidAt) : new Date();
    if (Number.isNaN(paymentDate.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid payment date" });
    }

    // allocations kept only for reporting (which month the user says this covers) —
    // NOT used for balance math anymore, so no more FIFO/window bugs.
    const payment = await Payment.create({
      customer: customerExists._id,
      amount: numericAmount,
      addedBy: collector,
      paidAt: paymentDate,
      note: note ? String(note).trim() : "",
      allocations: [{ month: numericMonth, year: numericYear, amount: numericAmount }],
    });

    const currentBalance = await recalcCustomerBalance(customerExists._id);

    const populatedPayment = await Payment.findById(payment._id)
      .populate("customer", "code name packageAmount")
      .lean();

    return res.status(201).json({
      success: true,
      message: "Payment added successfully",
      data: populatedPayment,
      currentBalance,
    });
  } catch (error) {
    console.error("ADD PAYMENT ERROR:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to add payment" });
  }
};

// ============================
// GET CUSTOMER BILLING (for the details page table)
// ============================

const getCustomerBilling = async (req, res) => {
  try {
    const { customerId } = req.params;
    const customer = await Customer.findById(customerId).populate("location", "name").lean();
    if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });

    const payments = await Payment.find({ customer: customerId }).sort({ paidAt: 1 }).lean();
    const start = getBillingStart(customer);
    const now = new Date();

    const months = buildBillingMonths(
      customer, payments,
      start.month, start.year,
      now.getMonth() + 1, now.getFullYear(),
    );

    const totalBalance = months.length ? months[months.length - 1].balance : 0;

    return res.json({ success: true, customer, months, totalBalance });
  } catch (error) {
    console.error("GET CUSTOMER BILLING ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch customer billing" });
  }
};

// ============================
// GET CUSTOMER PAYMENT HISTORY
// ============================

const getCustomerPayments = async (req, res) => {
  try {
    const { customerId } = req.params;
    const customer = await Customer.findById(customerId).populate("location", "name").lean();
    if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });

    const payments = await Payment.find({ customer: customerId }).sort({ paidAt: -1, createdAt: -1 }).lean();

    const totalPaid = payments.reduce((t, p) => t + Number(p.amount || 0), 0);
    const rajeshTotal = payments.filter((p) => p.addedBy === "RAJESH").reduce((t, p) => t + Number(p.amount || 0), 0);
    const shivamTotal = payments.filter((p) => p.addedBy === "SHIVAM").reduce((t, p) => t + Number(p.amount || 0), 0);

    return res.json({
      success: true, customer, count: payments.length,
      totals: { totalPaid, rajeshTotal, shivamTotal }, data: payments,
    });
  } catch (error) {
    console.error("Get customer payments error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch payment history" });
  }
};

// ============================
// GET MONTH PAYMENTS (by real payment date now, not allocations)
// ============================

const getMonthPayments = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ success: false, message: "Month and year are required" });
    }

    const numericMonth = Number(month);
    const numericYear = Number(year);
    const start = new Date(numericYear, numericMonth - 1, 1);
    const end = new Date(numericYear, numericMonth, 1);

    const payments = await Payment.find({ paidAt: { $gte: start, $lt: end } })
      .populate("customer", "code name nuid packageAmount location")
      .sort({ paidAt: 1 })
      .lean();

    const total = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    return res.json({ success: true, month: numericMonth, year: numericYear, count: payments.length, total, data: payments });
  } catch (error) {
    console.error("Get month payments error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch month payments" });
  }
};

// ============================
// CURRENT MONTH COLLECTION
// ============================

const getCurrentMonthCollection = async (req, res) => {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const payments = await Payment.find({ paidAt: { $gte: start, $lt: end } }).lean();

    const total = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const rajesh = payments.filter((p) => p.addedBy === "RAJESH").reduce((s, p) => s + Number(p.amount || 0), 0);
    const shivam = payments.filter((p) => p.addedBy === "SHIVAM").reduce((s, p) => s + Number(p.amount || 0), 0);

    return res.json({ success: true, month: now.getMonth() + 1, year: now.getFullYear(), total, rajesh, shivam, count: payments.length });
  } catch (error) {
    console.error("Get current month collection error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch current month collection" });
  }
};

// ============================
// GET ALL PAYMENTS
// ============================

const getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find({})
      .populate("customer", "code name nuid packageAmount location")
      .sort({ paidAt: -1, createdAt: -1 })
      .lean();

    const total = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const rajesh = payments.filter((p) => String(p.addedBy || "").toUpperCase() === "RAJESH").reduce((s, p) => s + Number(p.amount || 0), 0);
    const shivam = payments.filter((p) => String(p.addedBy || "").toUpperCase() === "SHIVAM").reduce((s, p) => s + Number(p.amount || 0), 0);

    return res.json({ success: true, count: payments.length, total, rajesh, shivam, data: payments });
  } catch (error) {
    console.error("Get all payments error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch payments" });
  }
};

module.exports = {
  addPayment,
  getCustomerBilling,
  getCustomerPayments,
  getMonthPayments,
  getCurrentMonthCollection,
  getAllPayments,
  recalcCustomerBalance,
};