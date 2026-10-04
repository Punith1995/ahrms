const express = require("express");
const c = require("../controllers/monthlyDeductionController");

const router = express.Router();

router.get("/", c.list);
router.post("/", c.save);

module.exports = router;
