const express = require("express");
const c = require("../controllers/companyController");
const { uploadDocument } = require("../middleware/upload");
const { documentChecklist } = require("../utils/documentChecklist");

const router = express.Router();

// the checklist itself, so the frontend never drifts out of step
router.get("/document-checklist", (req, res) => res.json(documentChecklist));

router.get("/", c.list);
router.post("/", c.create);
router.get("/:id", c.getOne);
router.put("/:id", c.update);
router.delete("/:id", c.remove);

router.post("/:id/logo", uploadDocument.single("file"), c.uploadLogo);
router.post(
  "/:id/documents/:docKey",
  uploadDocument.single("file"),
  c.uploadDocument
);
router.patch("/:id/documents/:docKey", c.updateDocument);

module.exports = router;
