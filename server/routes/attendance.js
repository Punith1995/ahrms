const express = require("express");
const c = require("../controllers/attendanceController");

const router = express.Router();

router.get("/", c.getMonth);
router.get("/all", c.getAll);
router.get("/summary", c.summary);
router.post("/mark", c.mark);
router.post("/clear", c.clear);
router.post("/clear-month", c.clearMonth);
router.post("/import", c.importCsv);
router.put("/ot", c.setOt);
router.post("/prefill", c.prefill);
router.post("/lock", c.setLock);

module.exports = router;
