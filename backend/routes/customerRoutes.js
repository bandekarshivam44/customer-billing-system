const express = require("express");
const multer = require("multer");

const router = express.Router();

const {
  getCustomers,
  searchCustomers,
  getCustomersByLocation,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  importCustomers,
  addBalanceAdjustment,
  updateCustomerStatus,
} = require("../controllers/customerController");

const {
  exportCustomers,
} = require("../controllers/customerImportExportController");

// ======================================================
// MULTER
// ======================================================

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

// ======================================================
// IMPORTANT: SPECIFIC ROUTES FIRST
// ======================================================

// Import Excel / CSV
router.post("/import", upload.single("file"), importCustomers);

// Export Excel
router.get("/export", exportCustomers);

// Search
router.get("/search", searchCustomers);

// Customers by location
router.get("/location/:locationId", getCustomersByLocation);

// ======================================================
// NORMAL CUSTOMER ROUTES
// ======================================================

// Get all
router.get("/", getCustomers);

// Create
router.post("/", createCustomer);

// Update
router.put("/:id", updateCustomer);

// Deactivate
router.delete("/:id", deleteCustomer);

// Get single customer
router.get("/:id", getCustomer);

router.post("/:id/balance-adjustments", addBalanceAdjustment);

router.patch("/:id/status", updateCustomerStatus);

module.exports = router;
