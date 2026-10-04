const express = require("express");
const c = require("../controllers/dashboardController");

const router = express.Router();

router.get("/", c.overview);

module.exports = router;
