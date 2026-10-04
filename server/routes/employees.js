const express = require("express");
const c = require("../controllers/employeeController");
const { uploadEmployeeDocument } = require("../middleware/upload");

const router = express.Router();

router.get("/document-checklist", c.checklist);
router.post("/salary-preview", c.previewSalary);

router.get("/", c.list);
router.post("/", c.create);
router.get("/:id", c.getOne);
router.put("/:id", c.update);
router.delete("/:id", c.remove);

router.get("/:id/blockers", c.blockers);
router.post("/:id/complete", c.complete);
router.post("/:id/withdraw", c.withdraw);
router.post("/:id/hold", c.holdSalary);
router.post("/:id/reactivate", c.reactivate);

router.post("/:id/photo", uploadEmployeeDocument.single("file"), c.uploadPhoto);

router.post(
  "/:id/documents/:docKey",
  uploadEmployeeDocument.single("file"),
  c.uploadDocument
);
router.patch("/:id/documents/:docKey", c.updateDocument);

module.exports = router;
