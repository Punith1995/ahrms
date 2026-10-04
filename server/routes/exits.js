const express = require("express");
const c = require("../controllers/exitController");

const router = express.Router();

router.get("/meta", c.meta);
router.get("/eligible", c.eligible);
router.get("/", c.list);
router.post("/", c.create);
router.get("/:id", c.getOne);
router.put("/:id", c.update);
router.post("/:id/suggest-settlement", c.suggestSettlement);
router.post("/:id/complete", c.complete);
router.delete("/:id", c.cancel);

module.exports = router;
