const express = require("express");
const c = require("../controllers/payslipController");

const router = express.Router();

router.get("/", c.list);
router.get("/bulk", c.bulk);
router.get("/:payslipId/pdf", c.one);

module.exports = router;
