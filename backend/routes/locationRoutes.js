const express = require("express");

const {
  getLocations,
  createLocation,
} = require("../controllers/locationController");

const router = express.Router();

router.get("/", getLocations);

router.post("/", createLocation);

module.exports = router;