const express = require("express");
const c = require("../controllers/leaveController");

const router = express.Router();

router.get("/meta", c.meta);
router.get("/balances", c.balances);
router.get("/policy", c.getPolicy);
router.put("/policy", c.setPolicy);
router.get("/employee/:employeeId", c.employee);
router.post("/encash", c.encash);
router.delete("/encash/:id", c.removeEncash);
router.post("/", c.add);
router.delete("/:id", c.remove);

module.exports = router;
