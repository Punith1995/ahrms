const fs = require("fs");
const path = require("path");
const multer = require("multer");

const ALLOWED = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Files land in uploads/{folder}/{id}/{docKey}-{timestamp}.{ext}
 * The timestamp means two uploads can never overwrite each other.
 */
function makeUploader(folder) {
  const storage = multer.diskStorage({
    destination(req, file, cb) {
      const dir = path.join(
        __dirname,
        "..",
        "uploads",
        folder,
        String(req.params.id)
      );
      cb(null, ensureDir(dir));
    },
    filename(req, file, cb) {
      const ext = ALLOWED[file.mimetype] || path.extname(file.originalname);
      const key = req.params.docKey || "logo";
      cb(null, `${key}-${Date.now()}${ext}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter(req, file, cb) {
      if (ALLOWED[file.mimetype]) return cb(null, true);
      cb(new Error("Only PDF, JPG and PNG files are accepted"));
    },
  });
}

const uploadDocument = makeUploader("companies");
const uploadEmployeeDocument = makeUploader("employees");

module.exports = { uploadDocument, uploadEmployeeDocument, makeUploader };
