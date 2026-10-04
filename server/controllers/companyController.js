const fs = require("fs");
const path = require("path");
const prisma = require("../utils/prisma");
const { documentKeys } = require("../utils/documentChecklist");

// --- helpers ---------------------------------------------------------------

const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const toDate = (v) => (v ? new Date(v) : null);

/** Shape a database row into what the React pages expect. */
function toDto(row) {
  const docs = {};
  documentKeys.forEach((key) => {
    docs[key] = { status: "pending", file: "", on: "", expires: "", url: "" };
  });

  (row.documents || []).forEach((d) => {
    docs[d.docKey] = {
      status: d.status,
      file: d.fileName || "",
      on: day(d.receivedOn),
      expires: day(d.expiresOn),
      url: d.filePath ? `/uploads/${d.filePath}` : "",
      size: d.fileSize || 0,
    };
  });

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    legalName: row.legalName,
    logo: row.logoUrl ? `/uploads/${row.logoUrl}` : "",
    entityType: row.entityType,
    industry: row.industry || "",
    status: row.status,
    onboardedOn: day(row.onboardedOn),
    headcount: row.headcount,
    address: row.address || "",
    city: row.city || "",
    state: row.state || "",
    pin: row.pin || "",
    contactPerson: row.contactPerson || "",
    phone: row.phone || "",
    email: row.email || "",
    registrations: row.registrations || {},
    bank: row.bank || {},
    payroll: row.payroll || {},
    compliance: row.compliance || {},
    authorization: row.authorization || {},
    docs,
  };
}

/** Only these fields can be written from the browser. */
function pickWritable(body) {
  const out = {};
  const plain = [
    "code", "name", "legalName", "entityType", "industry", "status",
    "address", "city", "state", "pin", "contactPerson", "phone", "email",
  ];
  plain.forEach((k) => {
    if (body[k] !== undefined) out[k] = body[k];
  });

  if (body.headcount !== undefined) out.headcount = Number(body.headcount) || 0;
  if (body.onboardedOn !== undefined) out.onboardedOn = toDate(body.onboardedOn);

  ["registrations", "bank", "payroll", "compliance", "authorization"].forEach(
    (k) => {
      if (body[k] !== undefined) out[k] = body[k];
    }
  );
  return out;
}

const withDocs = { documents: true };

// --- handlers --------------------------------------------------------------

exports.list = async (req, res, next) => {
  try {
    const rows = await prisma.company.findMany({
      include: withDocs,
      orderBy: { name: "asc" },
    });
    res.json(rows.map(toDto));
  } catch (e) {
    next(e);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const row = await prisma.company.findUnique({
      where: { id: Number(req.params.id) },
      include: withDocs,
    });
    if (!row) return res.status(404).json({ message: "Company not found" });
    res.json(toDto(row));
  } catch (e) {
    next(e);
  }
};

// derive a unique 3-char code from the company name
async function generateCode(base) {
  const clean = (base || "").replace(/[^A-Za-z]/g, "").toUpperCase();
  const root = (clean.slice(0, 3) || "COM").padEnd(3, "X");
  let code = root;
  let n = 1;
  // NEX → NE2, NE3 … then N10, N11 … then a timestamp fallback
  while (await prisma.company.findUnique({ where: { code } })) {
    n += 1;
    code = n < 10 ? root.slice(0, 2) + n : root.slice(0, 1) + n;
    if (n > 98) { code = "C" + String(Date.now()).slice(-3); break; }
  }
  return code;
}

exports.create = async (req, res, next) => {
  try {
    const data = pickWritable(req.body);
    const legal = (data.legalName || data.name || "").trim();
    if (!legal) {
      return res.status(400).json({ message: "Legal name is required" });
    }
    data.legalName = legal;
    data.name = (data.name || "").trim() || legal; // short name optional

    if (data.code) {
      data.code = data.code.toUpperCase();
      const exists = await prisma.company.findUnique({ where: { code: data.code } });
      if (exists) {
        return res.status(409).json({ message: `Code ${data.code} is already in use` });
      }
    } else {
      data.code = await generateCode(data.name || legal); // auto
    }

    data.onboardedOn = data.onboardedOn || new Date();

    const row = await prisma.company.create({
      data: {
        ...data,
        // every company starts with one row per checklist item
        documents: {
          create: documentKeys.map((docKey) => ({ docKey, status: "pending" })),
        },
      },
      include: withDocs,
    });

    res.status(201).json(toDto(row));
  } catch (e) {
    next(e);
  }
};

exports.update = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = pickWritable(req.body);
    if (data.code) data.code = data.code.toUpperCase();

    if (data.code) {
      const clash = await prisma.company.findFirst({
        where: { code: data.code, NOT: { id } },
      });
      if (clash) {
        return res
          .status(409)
          .json({ message: `Code ${data.code} belongs to another company` });
      }
    }

    const row = await prisma.company.update({
      where: { id },
      data,
      include: withDocs,
    });
    res.json(toDto(row));
  } catch (e) {
    if (e.code === "P2025")
      return res.status(404).json({ message: "Company not found" });
    next(e);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await prisma.company.delete({ where: { id } });
    fs.rmSync(path.join(__dirname, "..", "uploads", "companies", String(id)), {
      recursive: true,
      force: true,
    });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === "P2025")
      return res.status(404).json({ message: "Company not found" });
    next(e);
  }
};

// --- documents -------------------------------------------------------------

exports.uploadDocument = async (req, res, next) => {
  try {
    const companyId = Number(req.params.id);
    const { docKey } = req.params;

    if (!documentKeys.includes(docKey)) {
      return res.status(400).json({ message: "Unknown document type" });
    }
    if (!req.file) {
      return res.status(400).json({ message: "No file received" });
    }

    const relPath = path
      .join("companies", String(companyId), req.file.filename)
      .replace(/\\/g, "/");

    // remove the file this one replaces
    const previous = await prisma.companyDocument.findUnique({
      where: { companyId_docKey: { companyId, docKey } },
    });
    if (previous?.filePath) {
      fs.rmSync(path.join(__dirname, "..", "uploads", previous.filePath), {
        force: true,
      });
    }

    const doc = await prisma.companyDocument.upsert({
      where: { companyId_docKey: { companyId, docKey } },
      update: {
        status: "received",
        fileName: req.file.originalname,
        filePath: relPath,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        receivedOn: new Date(),
        expiresOn: toDate(req.body.expiresOn),
      },
      create: {
        companyId,
        docKey,
        status: "received",
        fileName: req.file.originalname,
        filePath: relPath,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        receivedOn: new Date(),
        expiresOn: toDate(req.body.expiresOn),
      },
    });

    res.status(201).json({
      docKey,
      status: doc.status,
      file: doc.fileName,
      on: day(doc.receivedOn),
      expires: day(doc.expiresOn),
      url: `/uploads/${doc.filePath}`,
      size: doc.fileSize,
    });
  } catch (e) {
    next(e);
  }
};

/** Change status without a file — marking N/A, or setting an expiry date. */
exports.updateDocument = async (req, res, next) => {
  try {
    const companyId = Number(req.params.id);
    const { docKey } = req.params;
    const { status, expiresOn } = req.body;

    if (!documentKeys.includes(docKey)) {
      return res.status(400).json({ message: "Unknown document type" });
    }
    if (status && !["pending", "received", "na"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const data = {};
    if (status) data.status = status;
    if (expiresOn !== undefined) data.expiresOn = toDate(expiresOn);

    // dropping to pending or N/A discards the stored file
    if (status && status !== "received") {
      const previous = await prisma.companyDocument.findUnique({
        where: { companyId_docKey: { companyId, docKey } },
      });
      if (previous?.filePath) {
        fs.rmSync(path.join(__dirname, "..", "uploads", previous.filePath), {
          force: true,
        });
      }
      Object.assign(data, {
        fileName: null,
        filePath: null,
        fileSize: null,
        mimeType: null,
        receivedOn: null,
      });
    }

    const doc = await prisma.companyDocument.upsert({
      where: { companyId_docKey: { companyId, docKey } },
      update: data,
      create: { companyId, docKey, status: status || "pending", ...data },
    });

    res.json({
      docKey,
      status: doc.status,
      file: doc.fileName || "",
      on: day(doc.receivedOn),
      expires: day(doc.expiresOn),
      url: doc.filePath ? `/uploads/${doc.filePath}` : "",
      size: doc.fileSize || 0,
    });
  } catch (e) {
    next(e);
  }
};

// --- logo ------------------------------------------------------------------

exports.uploadLogo = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!req.file) return res.status(400).json({ message: "No file received" });

    const relPath = path
      .join("companies", String(id), req.file.filename)
      .replace(/\\/g, "/");

    const current = await prisma.company.findUnique({ where: { id } });
    if (current?.logoUrl) {
      fs.rmSync(path.join(__dirname, "..", "uploads", current.logoUrl), {
        force: true,
      });
    }

    const row = await prisma.company.update({
      where: { id },
      data: { logoUrl: relPath },
      include: withDocs,
    });
    res.json(toDto(row));
  } catch (e) {
    next(e);
  }
};
