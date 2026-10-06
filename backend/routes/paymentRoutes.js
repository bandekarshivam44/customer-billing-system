const express = require("express");

const {
  addPayment,
  updatePayment,
  deletePayment,
  getCustomerBilling,
  getCustomerPayments,
  getMonthPayments,
  getCurrentMonthCollection,
  getAllPayments,
} = require("../controllers/paymentController");

const router = express.Router();

router.post("/", addPayment);

router.put("/:id", updatePayment);       

router.delete("/:id", deletePayment);    

router.get("/customer/:customerId/billing", getCustomerBilling);

router.get("/customer/:customerId", getCustomerPayments);

router.get("/month", getMonthPayments);

router.get("/current-month", getCurrentMonthCollection);

router.get("/", getAllPayments);

module.exports = router;
