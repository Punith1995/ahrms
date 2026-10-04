const express = require("express");
const c = require("../controllers/registerController");

const router = express.Router();

router.get("/", c.list);
router.get("/:id", c.download);

module.exports = router;
