const express = require("express");
const c = require("../controllers/payrollController");

const router = express.Router();

router.get("/preview", c.preview);
router.get("/run", c.getRun);
router.post("/run", c.run);
router.post("/finalise", c.finalise);
router.post("/mark-paid", c.markPaid);
router.post("/reopen", c.reopen);

module.exports = router;
