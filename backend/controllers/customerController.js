const Customer = require("../models/Customer");
const Location = require("../models/Location");
const Payment = require("../models/Payment");
const XLSX = require("xlsx");
const { recalcCustomerBalance } = require("./paymentController");
// ======================================================
// BILLING HELPERS
// ======================================================
const getMonthKey = (month, year) => {
  return Number(year) * 12 + Number(month);
};

const getMonthFromKey = (key) => {
  const year = Math.floor((key - 1) / 12);
  const month = ((key - 1) % 12) + 1;

  return { year, month };
};

const getPackageForMonth = (customer, month, year) => {
  const targetKey = getMonthKey(month, year);

  let packageAmount = Number(customer.packageAmount || 0);

  for (const history of customer.packageHistory || []) {
    const historyKey = getMonthKey(history.month, history.year);

    if (historyKey <= targetKey) {
      packageAmount = Number(history.amount || 0);
    }
  }

  return packageAmount;
};

// ======================================================
// GET ALL CUSTOMERS
// ======================================================
const getCustomers = async (req, res) => {
  try {
    const customers = await Customer.find()
      .populate("location", "name")
      .sort({ code: 1 })
      .lean();

    const customerIds = customers.map((customer) => customer._id);

    const payments = await Payment.find({
      customer: { $in: customerIds },
    })
      .sort({
        paidAt: 1,
        createdAt: 1,
      })
      .lean();

    const now = new Date();

    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const currentKey = getMonthKey(currentMonth, currentYear);

    const result = customers.map((customer) => {
      const customerPayments = payments.filter(
        (payment) => String(payment.customer) === String(customer._id),
      );

      const totalPaid = customerPayments.reduce(
        (sum, payment) => sum + Number(payment.amount || 0),
        0,
      );
      // ==================================================
      // BILLING START (source of truth, matches paymentController)
      // ==================================================
      const startMonth = customer.billingStartMonth || 1;
      const startYear = customer.billingStartYear || currentYear;
      const startKey = getMonthKey(startMonth, startYear);

      if (startKey > currentKey) {
        return {
          ...customer,
          totalPaid,
          currentBalance: 0,
          totalPayments: customerPayments.length,
          monthlyBilling: [],
        };
      }

      // ==================================================
      // OVERRIDE ANCHOR (reset point if one exists ≤ current month)
      // ==================================================
      const overrides = customer.balanceOverrides || [];
      let anchorKey = startKey;
      let base = 0;

      for (const o of overrides) {
        const k = getMonthKey(o.month, o.year);
        if (k <= currentKey && k >= anchorKey) {
          anchorKey = k + 1; // resume the month AFTER the override
          base = Number(o.balance || 0);
        }
      }

      // ==================================================
      // MONTHLY BILLING (running ledger, paidAt-based)
      // ==================================================
      const monthlyBilling = [];
      let runningOutstanding = base;

      const getStatusForMonth = (m, y) => {
        const targetKey = getMonthKey(m, y);
        let status = "active";
        [...(customer.statusHistory || [])]
          .sort(
            (a, b) =>
              getMonthKey(a.month, a.year) - getMonthKey(b.month, b.year),
          )
          .forEach((s) => {
            if (getMonthKey(s.month, s.year) <= targetKey) status = s.status;
          });
        return status;
      };

      if (customer.status === "free") {
        return {
          ...customer,
          totalPaid,
          currentBalance: 0,
          totalPayments: customerPayments.length,
          monthlyBilling: [],
        };
      }

      for (let key = anchorKey; key <= currentKey; key++) {
        const { year, month } = getMonthFromKey(key);
                const monthStatus = getStatusForMonth(month, year);
        const packageAmount =
          monthStatus === "inactive" || monthStatus === "free"
            ? 0
            : getPackageForMonth(customer, month, year);
        let monthPaid = 0;
        for (const payment of customerPayments) {
          const d = new Date(payment.paidAt);
          if (d.getFullYear() === year && d.getMonth() + 1 === month) {
            monthPaid += Number(payment.amount || 0);
          }
        }

        runningOutstanding = Math.max(
          0,
          runningOutstanding + packageAmount - monthPaid,
        );
        monthlyBilling.push({
          month,
          year,
          package: packageAmount,
          paid: monthPaid,
          balance: runningOutstanding,
        });
      }

      return {
        ...customer,
        totalPaid,
        currentBalance: runningOutstanding,
        totalPayments: customerPayments.length,
        monthlyBilling,
      };
    });

    return res.json({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (error) {
    console.error("Get customers error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch customers",
    });
  }
};
// ======================================================
// SEARCH CUSTOMERS
// ======================================================

const searchCustomers = async (req, res) => {
  try {
    const search = req.query.q?.trim();

    if (!search) {
      return res.json({
        success: true,
        count: 0,
        data: [],
      });
    }

    const regex = new RegExp(search, "i");

    const customers = await Customer.find({
      active: true,
      $or: [
        { code: regex },
        { name: regex },
        { nuid: regex },
        { mobile: regex },
      ],
    })
      .populate("location", "name")
      .sort({ name: 1 })
      .limit(50)
      .lean();

    return res.json({
      success: true,
      count: customers.length,
      data: customers,
    });
  } catch (error) {
    console.error("Customer search error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to search customers",
    });
  }
};

// ======================================================
// GET CUSTOMERS BY LOCATION
// ======================================================

const getCustomersByLocation = async (req, res) => {
  try {
    const customers = await Customer.find({
      location: req.params.locationId,
      active: true,
    })
      .populate("location", "name")
      .sort({ code: 1 })
      .lean();

    return res.json({
      success: true,
      count: customers.length,
      data: customers,
    });
  } catch (error) {
    console.error("Get location customers error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
    });
  }
};

// ======================================================
// GET SINGLE CUSTOMER
// ======================================================

const getCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id)
      .populate("location", "name")
      .lean();

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    console.error("Get customer error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch customer",
    });
  }
};

// ======================================================
// CREATE CUSTOMER
// ======================================================

const createCustomer = async (req, res) => {
  try {
    const {
      code,
      name,
      nuid = "",
      mobile = "",
      packageAmount,
      location,
      billingStartMonth,
      billingStartYear,
      active = true,
    } = req.body;

    if (
      !code ||
      !name ||
      packageAmount === undefined ||
      !location ||
      billingStartMonth === undefined ||
      billingStartYear === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Code, name, package amount, location, billing start month and billing start year are required",
      });
    }
    const startMonth = Number(billingStartMonth);
    const startYear = Number(billingStartYear);

    if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > 12) {
      return res.status(400).json({
        success: false,
        message: "Invalid billing start month",
      });
    }

    if (!Number.isInteger(startYear) || startYear < 2000) {
      return res.status(400).json({
        success: false,
        message: "Invalid billing start year",
      });
    }
    const packageNumber = Number(packageAmount);

    if (!Number.isFinite(packageNumber) || packageNumber < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid package amount",
      });
    }

    const locationExists = await Location.findById(location);

    if (!locationExists) {
      return res.status(400).json({
        success: false,
        message: "Selected location does not exist",
      });
    }

    const customerCode = String(code).trim().toUpperCase();

    const existingCustomer = await Customer.findOne({
      code: customerCode,
    });

    if (existingCustomer) {
      return res.status(409).json({
        success: false,
        message: "Customer code already exists",
      });
    }

    const initialStatus = ["active", "inactive", "free"].includes(
      req.body.status,
    )
      ? req.body.status
      : "active";

    const customer = await Customer.create({
      code: customerCode,
      name: String(name).trim(),
      nuid: String(nuid || "").trim(),
      mobile: String(mobile || "").trim(),
      packageAmount: packageNumber,
      billingStartMonth: startMonth,
      billingStartYear: startYear,
      location,
      active: Boolean(active),
      status: initialStatus,
      statusHistory: [
        { month: startMonth, year: startYear, status: initialStatus },
      ],
      packageHistory: [],
      balanceOverrides: [],
    });

    const populatedCustomer = await Customer.findById(customer._id)
      .populate("location", "name")
      .lean();

    return res.status(201).json({
      success: true,
      message: "Customer created successfully",
      data: populatedCustomer,
    });
  } catch (error) {
    console.error("Create customer error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create customer",
    });
  }
};

// ======================================================
// UPDATE CUSTOMER
// ======================================================

const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findById(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }
        const { code, name, nuid, mobile, packageAmount, location, active, status, statusMonth, statusYear } =
      req.body;
    // ------------------------------------------
    // CODE
    // ------------------------------------------

    if (code !== undefined) {
      const newCode = String(code).trim().toUpperCase();

      const duplicate = await Customer.findOne({
        code: newCode,
        _id: { $ne: id },
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: `Customer code ${newCode} already exists`,
        });
      }

      customer.code = newCode;
    }

    // ------------------------------------------
    // BASIC DETAILS
    // ------------------------------------------

    if (name !== undefined) {
      customer.name = String(name).trim();
    }

    if (nuid !== undefined) {
      customer.nuid = String(nuid).trim();
    }

    if (mobile !== undefined) {
      customer.mobile = String(mobile).trim();
    }

    // ------------------------------------------
    // PACKAGE
    // ------------------------------------------

    if (packageAmount !== undefined) {
      const newPackageAmount = Number(packageAmount);

      if (!Number.isFinite(newPackageAmount) || newPackageAmount < 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid package amount",
        });
      }

      const now = new Date();

      const changeMonth = now.getMonth() + 1;

      const changeYear = now.getFullYear();

      if (!customer.packageHistory) {
        customer.packageHistory = [];
      }

      // Remove existing entry
      // for this month
      customer.packageHistory = customer.packageHistory.filter(
        (item) =>
          !(
            Number(item.month) === changeMonth &&
            Number(item.year) === changeYear
          ),
      );

      // Add new package
      customer.packageHistory.push({
        month: changeMonth,
        year: changeYear,
        amount: newPackageAmount,
      });

      customer.packageAmount = newPackageAmount;
    }

    // ------------------------------------------
    // LOCATION
    // ------------------------------------------

    if (location !== undefined) {
      const locationExists = await Location.findById(location);

      if (!locationExists) {
        return res.status(400).json({
          success: false,
          message: "Selected location does not exist",
        });
      }

      customer.location = location;
    }

    // ------------------------------------------
    // ACTIVE

    if (active !== undefined) {
      customer.active = Boolean(active);
    }

    // ------------------------------------------
    // STATUS
    // ------------------------------------------

    if (status !== undefined && ["active", "inactive", "free"].includes(status)) {
      const now = new Date();
      const m = Number(req.body.statusMonth) || now.getMonth() + 1;
      const y = Number(req.body.statusYear) || now.getFullYear();

      if (!customer.statusHistory) customer.statusHistory = [];
      customer.statusHistory = customer.statusHistory.filter(
        (s) => !(s.month === m && s.year === y),
      );
      customer.statusHistory.push({ month: m, year: y, status });

      // Recompute the LIVE status as-of the real current month,
      // not just "whatever was last submitted"
      const todayKey = now.getFullYear() * 12 + (now.getMonth() + 1);
      const applicable = [...customer.statusHistory]
        .filter((s) => s.year * 12 + s.month <= todayKey)
        .sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month))[0];

      customer.status = applicable ? applicable.status : "active";
    }
    await customer.save();

    const updatedCustomer = await Customer.findById(customer._id)
      .populate("location", "name")
      .lean();

    return res.json({
      success: true,
      message: "Customer updated successfully",
      data: updatedCustomer,
    });
  } catch (error) {
    console.error("Update customer error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update customer",
    });
  }
};

// ======================================================
// DEACTIVATE CUSTOMER
// ======================================================

const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    await Payment.deleteMany({ customer: customer._id });
    await Customer.findByIdAndDelete(customer._id);

    return res.json({
      success: true,
      message: "Customer permanently deleted",
    });
  } catch (error) {
    console.error("Delete customer error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ======================================================
// IMPORT CUSTOMERS FROM EXCEL / CSV
// ======================================================
const importCustomers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Excel or CSV file is required" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    if (!workbook.SheetNames.length) {
      return res.status(400).json({ success: false, message: "No worksheet found" });
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    if (!rows.length) {
      return res.status(400).json({ success: false, message: "File contains no customer records" });
    }

    let created = 0, updated = 0, skipped = 0;
    let paymentsCreated = 0, statusEntriesCreated = 0, advanceAdjustmentsCreated = 0;
    const errors = [];

    const MONTH_COLUMNS = [
      { prefix: "JUNE", month: 6, year: 2026 },
      { prefix: "JULY", month: 7, year: 2026 },
      { prefix: "AUG", month: 8, year: 2026 },
    ];

    const getCell = (row, ...keys) => {
      for (const k of keys) if (row[k] !== undefined && row[k] !== "") return row[k];
      return "";
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        const code = String(getCell(row, "CODE", "Code", "code")).trim().toUpperCase();
        const name = String(getCell(row, "NAME", "Name", "name")).trim();

        const issueText = String(getCell(row, "ISSUE", "Issue", "issue")).trim();
        if (issueText) {
          skipped++;
          errors.push({ row: i + 2, code, reason: `Flagged in source file: ${issueText}` });
          continue;
        }

        const packRaw = getCell(row, "PACKAGE", "Package", "package", "PACK", "Pack", "pack");
        const otherFieldsEmpty = !code && !String(getCell(row, "NUID")).trim() && !String(packRaw).trim();
        if (name && otherFieldsEmpty) continue;

        const nuid = String(getCell(row, "NUID", "Nuid", "nuid")).trim();
        const mobile = String(getCell(row, "MOBILE", "Mobile", "mobile")).trim();
        const packageAmount = Number(packRaw);
        const locationValue = String(getCell(row, "LOCATION", "Location", "location")).trim();

        if (!code || !name || !Number.isFinite(packageAmount) || !locationValue) {
          skipped++;
          errors.push({ row: i + 2, code, reason: "CODE, NAME, PACKAGE and LOCATION are required" });
          continue;
        }

        let location;
        if (/^[0-9a-fA-F]{24}$/.test(locationValue)) {
          location = await Location.findById(locationValue);
        } else {
          location = await Location.findOne({
            name: { $regex: `^${escapeRegex(locationValue)}$`, $options: "i" },
          });
        }

        if (!location) {
          skipped++;
          errors.push({ row: i + 2, code, reason: `Location "${locationValue}" not found` });
          continue;
        }

        let customer = await Customer.findOne({ code });

        if (customer) {
          customer.name = name;
          customer.nuid = nuid;
          customer.mobile = mobile;
          customer.packageAmount = packageAmount;
          customer.location = location._id;
          updated++;
        } else {
          customer = new Customer({
            code, name, nuid, mobile, packageAmount,
            location: location._id,
            billingStartMonth: 6,
            billingStartYear: 2026,
            packageHistory: [],
            balanceOverrides: [],
            statusHistory: [],
            active: true,
          });
          created++;
        }

        if (!customer.balanceOverrides) customer.balanceOverrides = [];
        if (!customer.statusHistory) customer.statusHistory = [];

        // Save the base customer record FIRST, independent of month processing below —
        // so even if a payment fails, the customer + any status/override entries
        // collected so far are never lost.
        await customer.save();

        for (const { prefix, month, year } of MONTH_COLUMNS) {
          try {
            const paidCellRaw = getCell(row, `${prefix}_PAID`, `${prefix}_Paid`);
            const paidCell = String(paidCellRaw).trim().toUpperCase();

            if (paidCell === "DC") {
              customer.statusHistory = customer.statusHistory.filter(
                (s) => !(s.month === month && s.year === year),
              );
              customer.statusHistory.push({ month, year, status: "inactive" });
              await customer.save();
              statusEntriesCreated++;
              continue;
            }

            if (paidCell === "FREE") {
              customer.statusHistory = customer.statusHistory.filter(
                (s) => !(s.month === month && s.year === year),
              );
              customer.statusHistory.push({ month, year, status: "free" });
              await customer.save();
              statusEntriesCreated++;
              continue;
            }

            if (paidCell === "PD") {
              customer.balanceOverrides.push({
                month, year, type: "deduct", amount: packageAmount,
                reason: "Paid in advance (PD, imported)",
                createdAt: new Date(),
              });
              await customer.save();
              advanceAdjustmentsCreated++;
              continue;
            }

            const paidNumber = Number(paidCellRaw);
            if (Number.isFinite(paidNumber) && paidNumber > 0) {
              await Payment.create({
                customer: customer._id,
                amount: paidNumber,
                addedBy: "RAJESH", // required enum - see note below
                paidAt: new Date(year, month - 1, 28),
                note: "Imported from spreadsheet",
                allocations: [{ month, year, amount: paidNumber }],
              });
              paymentsCreated++;
            }
          } catch (monthError) {
            errors.push({
              row: i + 2, code,
              reason: `${prefix}: ${monthError.message}`,
            });
          }
        }

        if (typeof recalcCustomerBalance === "function") {
          await recalcCustomerBalance(customer._id);
        }
      } catch (rowError) {
        skipped++;
        errors.push({ row: i + 2, reason: rowError.message });
      }
    }

    return res.json({
      success: true,
      message: "Customer import completed",
      summary: { totalRows: rows.length, created, updated, skipped, paymentsCreated, statusEntriesCreated, advanceAdjustmentsCreated },
      errors,
    });
  } catch (error) {
    console.error("Import customers error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to import customers" });
  }
};
// ======================================================
// HELPER
// ======================================================

const escapeRegex = (value) => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};
// ======================================================
// UPDATE BALANCE OVERRIDES
// ======================================================
const updateBalanceOverrides = async (req, res) => {
  try {
    const { overrides, replace } = req.body;
    const customer = await Customer.findById(req.params.id);
    if (!customer)
      return res.status(404).json({ success: false, message: "Not found" });

    if (replace) {
      customer.balanceOverrides = overrides.map((o) => ({
        month: o.month,
        year: o.year,
        delta: o.delta,
      }));
    } else {
      for (const o of overrides) {
        const idx = customer.balanceOverrides.findIndex(
          (x) => x.month === o.month && x.year === o.year,
        );
        if (idx >= 0) customer.balanceOverrides[idx].delta = o.delta;
        else
          customer.balanceOverrides.push({
            month: o.month,
            year: o.year,
            delta: o.delta,
          });
      }
    }
    await customer.save();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};
const addBalanceAdjustment = async (req, res) => {
  try {
    const { month, year, type, amount, reason } = req.body;

    if (
      month == null ||
      year == null ||
      !["add", "deduct"].includes(type) ||
      amount == null
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message: "month, year, type ('add'|'deduct') and amount are required",
        });
    }

    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Amount must be greater than 0" });
    }

    const customer = await Customer.findById(req.params.id);
    if (!customer)
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });

    if (!customer.balanceOverrides) customer.balanceOverrides = [];

    customer.balanceOverrides.push({
      month: Number(month),
      year: Number(year),
      type,
      amount: amountNumber,
      reason: (reason || "").trim(),
      createdAt: new Date(),
    });

    await customer.save();
    res.json({ success: true, message: "Adjustment added", data: customer });
  } catch (error) {
    console.error("Balance adjustment error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to add adjustment",
      });
  }
};
const updateCustomerStatus = async (req, res) => {
  try {
    const { status, month, year } = req.body;
    if (!["active", "inactive", "free"].includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });
    }

    const customer = await Customer.findById(req.params.id);
    if (!customer)
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });

    const now = new Date();
    const m = Number(month) || now.getMonth() + 1;
    const y = Number(year) || now.getFullYear();

    if (!customer.statusHistory) customer.statusHistory = [];
    customer.statusHistory = customer.statusHistory.filter(
      (s) => !(s.month === m && s.year === y),
    );
        customer.statusHistory.push({ month: m, year: y, status });

    const now2 = new Date();
    const todayKey = now2.getFullYear() * 12 + (now2.getMonth() + 1);
    const applicable = [...customer.statusHistory]
      .filter((s) => s.year * 12 + s.month <= todayKey)
      .sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month))[0];

    customer.status = applicable ? applicable.status : "active";

    await customer.save();
    const updated = await Customer.findById(customer._id)
      .populate("location", "name")
      .lean();
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update status error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  getCustomers,
  searchCustomers,
  getCustomersByLocation,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  importCustomers,
  updateBalanceOverrides,
  addBalanceAdjustment,
  updateCustomerStatus,
};
