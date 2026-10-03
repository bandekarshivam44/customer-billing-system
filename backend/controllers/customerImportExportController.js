const XLSX = require("xlsx");
const Customer = require("../models/Customer");
const Location = require("../models/Location");

// ======================================================
// IMPORT CUSTOMERS FROM EXCEL / CSV
// ======================================================
const Payment = require("../models/Payment"); // adjust path/name to your project

const MONTH_LOOKUP = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const keyOf = (month, year) => year * 12 + month;

const normalizeKey = (key) =>
  String(key).trim().toLowerCase().replace(/[\s_\-]/g, "");

const toAmount = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  const cleaned = String(value).replace(/[₹,\s]/g, "");
  if (cleaned === "") return null;
  return Number(cleaned);
};

const STATUS_WORDS = {
  dc: "inactive",
  inactive: "inactive",
  free: "free",
  active: "active",
};
const toStatusWord = (value) =>
  typeof value === "string"
    ? STATUS_WORDS[value.trim().toLowerCase()] || null
    : null;

const pick = (flat, ...names) => {
  for (const n of names) {
    if (flat[n] !== undefined && flat[n] !== "") return flat[n];
  }
  return "";
};

const normalizeRow = (row) => {
  const flat = {};
  const byMonth = {};
  const badColumns = [];

  Object.entries(row).forEach(([key, value]) => {
    const nk = normalizeKey(key);
    const match = nk.match(/^([a-z]{3,9})(\d{4})(paid|bal|balance)$/);

    if (match && MONTH_LOOKUP[match[1].slice(0, 3)]) {
      const month = MONTH_LOOKUP[match[1].slice(0, 3)];
      const year = Number(match[2]);
      const id = `${year}-${month}`;
      if (!byMonth[id]) {
        byMonth[id] = { month, year, paid: null, balance: null, statusFlags: [] };
      }

      const word = toStatusWord(value);
      if (word) {
        byMonth[id].statusFlags.push(word);
        return;
      }

      const amount = toAmount(value);
      if (amount === null) return;
      if (!Number.isFinite(amount) || amount < 0) {
        badColumns.push(key);
        return;
      }
      if (match[3] === "paid") byMonth[id].paid = amount;
      else byMonth[id].balance = amount;
      return;
    }

    flat[nk] = value;
  });

  const monthData = Object.values(byMonth).sort(
    (a, b) => keyOf(a.month, a.year) - keyOf(b.month, b.year),
  );

  return { flat, monthData, badColumns };
};

const importCustomers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload an Excel or CSV file",
      });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]; // first sheet only
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message: "The uploaded file is empty",
      });
    }

    const now = new Date();
    const nowKey = keyOf(now.getMonth() + 1, now.getFullYear());

    // Billing always starts from LAST month (Oct -> Sept, Jan -> previous Dec)
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthNum = prevDate.getMonth() + 1;
    const prevYearNum = prevDate.getFullYear();

    const imported = [];
    const skipped = [];
    const errors = [];
    const warnings = [];
    let paymentsCreated = 0;
    let adjustmentsCreated = 0;

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2;
      const { flat, monthData: allMonthData, badColumns } = normalizeRow(rows[i]);

      // Only last month's Paid / Balance are read
      const monthData = allMonthData.filter(
        (m) => m.month === prevMonthNum && m.year === prevYearNum,
      );

      const code = String(pick(flat, "code")).trim().toUpperCase();
      const name = String(pick(flat, "name")).trim().toUpperCase();
      const nuid = String(pick(flat, "nuid")).trim().toUpperCase();
      const locationValue = String(pick(flat, "location")).trim();
      const addedBy =
        String(pick(flat, "addedby", "collectedby")).trim().toUpperCase() ||
        "RAJESH";
      const packageAmount = toAmount(pick(flat, "packageamount", "package")) ?? 0;

      const fail = (message) =>
        errors.push({ row: rowNumber, code, message });

      // ---------- validation ----------
      if (!code || !name) {
        fail("Code and name are required");
        continue;
      }
      if (!Number.isFinite(packageAmount) || packageAmount < 0) {
        fail("Invalid package amount");
        continue;
      }
      if (badColumns.length) {
        fail(`Invalid amount in: ${badColumns.join(", ")}`);
        continue;
      }
      if (!["RAJESH", "SHIVAM"].includes(addedBy)) {
        fail(`Invalid addedBy "${addedBy}" (use RAJESH or SHIVAM)`);
        continue;
      }

      // ---------- auto status from the month cells ----------
      const flags = [...new Set(monthData.flatMap((m) => m.statusFlags))];
      if (flags.length > 1) {
        fail(`Conflicting status in month cells: ${flags.join(" / ")}`);
        continue;
      }
      const status = flags[0] || "active";

      // ---------- billing start (fixed: last month) ----------
      const billingStartMonth = prevMonthNum;
      const billingStartYear = prevYearNum;
      const startKey = keyOf(billingStartMonth, billingStartYear);

      // ---------- location ----------
      let location = null;
      if (locationValue) {
        location = await Location.findOne({
          name: new RegExp(`^${escapeRegex(locationValue)}$`, "i"),
        });
      }
      if (!location) {
        fail(`Location "${locationValue}" not found`);
        continue;
      }

      // ---------- duplicate ----------
      const existingCustomer = await Customer.findOne({ code });
      if (existingCustomer) {
        skipped.push({
          row: rowNumber,
          code,
          reason: "Customer code already exists",
        });
        continue;
      }

      // ---------- build payments + balance adjustments ----------
      const effectivePackage = status === "active" ? packageAmount : 0;
      let paidSoFar = 0;
      let adjustmentSoFar = 0;
      const paymentDocs = [];
      const overrides = [];

      monthData.forEach(({ month, year, paid, balance }) => {
        const key = keyOf(month, year);

        if (paid && paid > 0) {
          paidSoFar += paid;
          paymentDocs.push({
            month,
            year,
            amount: paid,
            addedBy,
            note: "Imported",
            paidAt: key === nowKey ? now : new Date(year, month - 1, 15, 12, 0, 0),
          });
        }

        if (balance !== null) {
          const dueSoFar = effectivePackage * (key - startKey + 1);
          // adjustments needed so that: due + adjustments - paid = balance
          const target =
            balance > 0
              ? balance - dueSoFar + paidSoFar
              : Math.min(0, paidSoFar - dueSoFar);
          const delta = target - adjustmentSoFar;

          if (delta !== 0) {
            overrides.push({
              month,
              year,
              type: delta > 0 ? "add" : "deduct",
              amount: Math.abs(delta),
              reason: "Imported opening balance",
              createdAt: now,
            });
            adjustmentSoFar = target;
          }
        }
      });

      // ---------- create customer (no mobile) ----------
      const customer = await Customer.create({
        code,
        name,
        nuid,
        packageAmount,
        location: location._id,
        billingStartMonth,
        billingStartYear,
        status,
        statusHistory:
          status === "active"
            ? []
            : [{ status, month: billingStartMonth, year: billingStartYear }],
        packageHistory: [],
        balanceOverrides: overrides,
        active: true,
      });

      // ---------- SELF-CHECK 1: did the database keep the billing start? ----------
      if (
        Number(customer.billingStartMonth) !== billingStartMonth ||
        Number(customer.billingStartYear) !== billingStartYear
      ) {
        warnings.push(
          `${code}: billing start was NOT saved (got ${customer.billingStartMonth}/${customer.billingStartYear}). Check the Customer schema.`,
        );
      }

      // ---------- create payments (roll back the customer if this fails) ----------
      if (paymentDocs.length) {
        try {
          const inserted = await Payment.insertMany(
            paymentDocs.map((p) => ({ ...p, customer: customer._id })),
          );

          // SELF-CHECK 2: did the database keep the payment date?
          inserted.forEach((doc, idx) => {
            const d = new Date(doc.paidAt);
            const want = paymentDocs[idx];
            if (
              Number.isNaN(d.getTime()) ||
              d.getMonth() + 1 !== want.month ||
              d.getFullYear() !== want.year
            ) {
              warnings.push(
                `${code}: payment date was NOT saved as ${want.month}/${want.year} (got ${doc.paidAt}). Check the Payment schema.`,
              );
            }
          });
          // If your normal payment controller also updates customer.monthlyBilling
          // (or similar), call that same helper here for this customer.
        } catch (paymentError) {
          await Customer.findByIdAndDelete(customer._id);
          fail(`Payments could not be saved: ${paymentError.message}`);
          continue;
        }
      }

      paymentsCreated += paymentDocs.length;
      adjustmentsCreated += overrides.length;

      imported.push({
        id: customer._id,
        code: customer.code,
        name: customer.name,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Customer import completed",
      importedCount: imported.length,
      skippedCount: skipped.length,
      errorCount: errors.length,
      paymentsCreated,
      adjustmentsCreated,
      warningCount: warnings.length,
      warnings: warnings.slice(0, 20),
      imported,
      skipped,
      errors,
    });
  } catch (error) {
    console.error("Import customers error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to import customers",
    });
  }
};
// ======================================================
// EXPORT CUSTOMERS
// ======================================================
const exportCustomers = async (req, res) => {
  try {
    const customers = await Customer.find()
      .populate("location", "name")
      .sort({ code: 1 })
      .lean();

    const columns = req.query.columns
      ? req.query.columns.split(",")
      : [
          "code",
          "name",
          "nuid",
          "package",
          "june",
          "juneBalance",
          "july",
          "julyBalance",
          "august",
          "augustBalance",
        ];

    const rows = customers.map((customer) => {
      const row = {};

      if (columns.includes("code")) {
        row.CODE = customer.code || "";
      }

      if (columns.includes("name")) {
        row.NAME = customer.name || "";
      }

      if (columns.includes("nuid")) {
        row.NUID = customer.nuid || "";
      }

      if (columns.includes("package")) {
        row.PACKAGE = customer.packageAmount || 0;
      }

      /*
       * Month values will be filled from the customer's
       * payment/billing data.
       *
       * For now these are placeholders until we connect
       * the Payment allocation calculation.
       */

      if (columns.includes("june")) {
        row.JUNE = 0;
      }

      if (columns.includes("juneBalance")) {
        row["JUNE BAL"] = 0;
      }

      if (columns.includes("july")) {
        row.JULY = 0;
      }

      if (columns.includes("julyBalance")) {
        row["JULY BAL"] = 0;
      }

      if (columns.includes("august")) {
        row.AUG = 0;
      }

      if (columns.includes("augustBalance")) {
        row["AUG BAL"] = 0;
      }

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Customers"
    );

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="customers.xlsx"'
    );

    return res.send(buffer);
  } catch (error) {
    console.error("Export customers error:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message || "Failed to export customers",
    });
  }
};

// ======================================================
// HELPER
// ======================================================

const escapeRegex = (value) => {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
};

module.exports = {
  importCustomers,
  exportCustomers,
};