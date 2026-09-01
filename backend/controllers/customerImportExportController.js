const XLSX = require("xlsx");
const Customer = require("../models/Customer");
const Location = require("../models/Location");

// ======================================================
// IMPORT CUSTOMERS FROM EXCEL / CSV
// ======================================================

const importCustomers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload an Excel or CSV file",
      });
    }

    const workbook = XLSX.read(req.file.buffer, {
      type: "buffer",
    });

    const sheetName = workbook.SheetNames[0];

    const worksheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(worksheet, {
      defval: "",
    });

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message: "The uploaded file is empty",
      });
    }

    const imported = [];
    const skipped = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const rowNumber = i + 2;

      const code = String(
        row.code ||
          row.Code ||
          row.CODE ||
          ""
      )
        .trim()
        .toUpperCase();

      const name = String(
        row.name ||
          row.Name ||
          row.NAME ||
          ""
      ).trim();

      const nuid = String(
        row.nuid ||
          row.NUID ||
          row.Nuid ||
          ""
      ).trim();

      const mobile = String(
        row.mobile ||
          row.Mobile ||
          row.MOBILE ||
          ""
      ).trim();

      const packageAmount = Number(
        row.packageAmount ||
          row.PackageAmount ||
          row["Package Amount"] ||
          0
      );

      const locationValue = String(
        row.location ||
          row.Location ||
          ""
      ).trim();

      // --------------------------------------------
      // REQUIRED FIELDS
      // --------------------------------------------

      if (!code || !name) {
        errors.push({
          row: rowNumber,
          message: "Code and name are required",
        });

        continue;
      }

      if (
        !Number.isFinite(packageAmount) ||
        packageAmount < 0
      ) {
        errors.push({
          row: rowNumber,
          code,
          message: "Invalid package amount",
        });

        continue;
      }

      // --------------------------------------------
      // FIND LOCATION
      // --------------------------------------------

      let location = null;

      if (locationValue) {
        location = await Location.findOne({
          $or: [
            {
              name: new RegExp(
                `^${escapeRegex(locationValue)}$`,
                "i"
              ),
            },
          ],
        });
      }

      if (!location) {
        errors.push({
          row: rowNumber,
          code,
          message: `Location "${locationValue}" not found`,
        });

        continue;
      }

      // --------------------------------------------
      // CHECK EXISTING CUSTOMER
      // --------------------------------------------

      const existingCustomer =
        await Customer.findOne({
          code,
        });

      if (existingCustomer) {
        skipped.push({
          row: rowNumber,
          code,
          reason: "Customer code already exists",
        });

        continue;
      }

      // --------------------------------------------
      // CREATE CUSTOMER
      // --------------------------------------------

      const customer = await Customer.create({
        code,
        name,
        nuid,
        mobile,
        packageAmount,
        location: location._id,
        packageHistory: [],
        balanceOverrides: [],
        active: true,
      });

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
      imported,
      skipped,
      errors,
    });
  } catch (error) {
    console.error(
      "Import customers error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to import customers",
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