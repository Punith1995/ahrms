const express = require("express");
const c = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/login", c.login);
router.get("/me", requireAuth, c.me);
router.post("/change-password", requireAuth, c.changePassword);

module.exports = router;
