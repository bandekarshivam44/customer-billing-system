const express = require("express");
const { pushChanges, pullChanges } = require("../controllers/syncController");

const router = express.Router();

router.post("/push", pushChanges);

router.get("/pull", pullChanges);

module.exports = router;