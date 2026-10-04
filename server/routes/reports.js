const express = require("express");
const c = require("../controllers/reportController");

const router = express.Router();

router.get("/catalog", c.catalog);
router.get("/preview", c.preview);
router.get("/export", c.export);

module.exports = router;
