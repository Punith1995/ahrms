const fs = require("fs");
const path = require("path");
const prisma = require("../utils/prisma");
const { computeBreakup, buildFromComponents } = require("../utils/salary");
const {
  employeeChecklist,
  employeeDocKeys,
} = require("../utils/employeeChecklist");

const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const toDate = (v) => (v ? new Date(v) : null);

// --- shaping ---------------------------------------------------------------

function toDto(row) {
  const docs = {};
  employeeDocKeys.forEach((key) => {
    docs[key] = { status: "pending", file: "", on: "", url: "", size: 0 };
  });
  (row.documents || []).forEach((d) => {
    docs[d.docKey] = {
      status: d.status,
      file: d.fileName || "",
      on: day(d.receivedOn),
      url: d.filePath ? `/uploads/${d.filePath}` : "",
      size: d.fileSize || 0,
    };
  });

  return {
    id: row.id,
    companyId: row.companyId,
    company: row.company
      ? { id: row.company.id, name: row.company.name, code: row.company.code }
      : null,
    employeeCode: row.employeeCode,
    photoUrl: row.photoUrl || null,

    fullName: row.fullName,
    fatherSpouseName: row.fatherSpouseName || "",
    dob: day(row.dob),
    gender: row.gender || "",
    maritalStatus: row.maritalStatus || "",
    mobile: row.mobile || "",
    email: row.email || "",
    address: row.address || "",
    emergencyName: row.emergencyName || "",
    emergencyPhone: row.emergencyPhone || "",

    designation: row.designation || "",
    department: row.department || "",
    doj: day(row.doj),
    employmentType: row.employmentType || "Permanent",
    workLocation: row.workLocation || "",
    reportingTo: row.reportingTo || "",
    probationMonths: row.probationMonths ?? 0,
    shiftPattern: row.shiftPattern || "",
    weeklyOff: row.weeklyOff || "",

    aadhaar: row.aadhaar || "",
    pan: row.pan || "",
    uan: row.uan || "",
    esicIp: row.esicIp || "",
    pfApplicable: row.pfApplicable,
    esiApplicable: row.esiApplicable,
    ptApplicable: row.ptApplicable,
    previousPfMember: row.previousPfMember,

    bankAccountName: row.bankAccountName || "",
    bankName: row.bankName || "",
    bankAccountNo: row.bankAccountNo || "",
    bankIfsc: row.bankIfsc || "",

    ctcMonthly: row.ctcMonthly || 0,
    salaryStructure: row.salaryStructure || {},

    joiningStage: row.joiningStage,
    joiningStatus: row.joiningStatus,
    status: row.status,
    salaryHold: row.salaryHold || false,
    salaryHoldReason: row.salaryHoldReason || "",
    startedOn: day(row.startedOn),
    joinedOn: day(row.joinedOn),
    notes: row.notes || "",

    docs,
  };
}

const WRITABLE_TEXT = [
  "fullName", "fatherSpouseName", "gender", "maritalStatus", "mobile", "email",
  "address", "emergencyName", "emergencyPhone", "designation", "department",
  "employmentType", "workLocation", "reportingTo", "shiftPattern", "weeklyOff",
  "aadhaar", "pan", "uan", "esicIp", "bankAccountName", "bankName",
  "bankAccountNo", "bankIfsc", "joiningStage", "notes",
];
const WRITABLE_BOOL = [
  "pfApplicable", "esiApplicable", "ptApplicable", "previousPfMember",
];

function pickWritable(body) {
  const out = {};
  WRITABLE_TEXT.forEach((k) => {
    if (body[k] !== undefined) out[k] = body[k];
  });
  WRITABLE_BOOL.forEach((k) => {
    if (body[k] !== undefined) out[k] = !!body[k];
  });
  if (body.dob !== undefined) out.dob = toDate(body.dob);
  if (body.doj !== undefined) out.doj = toDate(body.doj);
  if (body.probationMonths !== undefined)
    out.probationMonths = Number(body.probationMonths) || 0;
  if (body.ctcMonthly !== undefined)
    out.ctcMonthly = Math.round(Number(body.ctcMonthly) || 0);
  return out;
}

const include = { documents: true, company: true };

/** Next code for a company: NEX001, NEX002, ... */
async function nextEmployeeCode(companyId) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return null;
  const count = await prisma.employee.count({ where: { companyId } });
  return `${company.code}${String(count + 1).padStart(3, "0")}`;
}

/** Recalculate the breakup from the company's own compliance settings. */
async function freshStructure(companyId, ctcMonthly, split) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  return computeBreakup(ctcMonthly, company?.compliance || {}, split || {});
}

// --- handlers --------------------------------------------------------------

exports.checklist = (req, res) => res.json(employeeChecklist);

exports.list = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.companyId) where.companyId = Number(req.query.companyId);
    if (req.query.joiningStatus) where.joiningStatus = req.query.joiningStatus;
    if (req.query.status) where.status = req.query.status;

    const rows = await prisma.employee.findMany({
      where,
      include,
      orderBy: { startedOn: "desc" },
    });
    res.json(rows.map(toDto));
  } catch (e) {
    next(e);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const row = await prisma.employee.findUnique({
      where: { id: Number(req.params.id) },
      include,
    });
    if (!row) return res.status(404).json({ message: "Employee not found" });
    res.json(toDto(row));
  } catch (e) {
    next(e);
  }
};

exports.create = async (req, res, next) => {
  try {
    const companyId = Number(req.body.companyId);
    const fullName = (req.body.fullName || "").trim();

    if (!companyId) return res.status(400).json({ message: "Pick a company" });
    if (!fullName)
      return res.status(400).json({ message: "Full name is required" });

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company)
      return res.status(404).json({ message: "That company no longer exists" });

    const employeeCode =
      (req.body.employeeCode || "").trim() ||
      (await nextEmployeeCode(companyId));

    const clash = await prisma.employee.findFirst({
      where: { companyId, employeeCode },
    });
    if (clash) {
      return res
        .status(409)
        .json({ message: `${employeeCode} is already used at this company` });
    }

    const data = pickWritable(req.body);
    const ctc = data.ctcMonthly || 0;

    const row = await prisma.employee.create({
      data: {
        ...data,
        companyId,
        employeeCode,
        fullName,
        // statutory defaults come from the company, not from thin air
        pfApplicable: company.compliance?.pfApplicable ?? true,
        esiApplicable: company.compliance?.esiApplicable ?? true,
        weeklyOff: data.weeklyOff || company.payroll?.weeklyOff || "Sunday",
        salaryStructure: computeBreakup(ctc, company.compliance || {}),
        joiningStage: "personal",
        joiningStatus: "in_progress",
        status: "Onboarding",
        documents: {
          create: employeeDocKeys.map((docKey) => ({ docKey, status: "pending" })),
        },
      },
      include,
    });

    res.status(201).json(toDto(row));
  } catch (e) {
    next(e);
  }
};

exports.update = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing)
      return res.status(404).json({ message: "Employee not found" });

    const data = pickWritable(req.body);

    // Employee code (ID) can be changed, but must stay unique within the company.
    if (req.body.employeeCode !== undefined) {
      const code = String(req.body.employeeCode).trim();
      if (!code) {
        return res.status(400).json({ message: "Employee code cannot be blank" });
      }
      if (code !== existing.employeeCode) {
        const clash = await prisma.employee.findFirst({
          where: {
            companyId: existing.companyId,
            employeeCode: code,
            id: { not: id },
          },
        });
        if (clash) {
          return res
            .status(409)
            .json({ message: `${code} is already used at this company` });
        }
        data.employeeCode = code;
      }
    }


      data.ctcMonthly !== undefined && data.ctcMonthly !== existing.ctcMonthly;
    const rulesChanged =
      data.pfApplicable !== undefined || data.esiApplicable !== undefined;

    const wantsManual =
      req.body.salaryMode === "manual" && req.body.salaryComponents;

    if (wantsManual || ctcChanged || rulesChanged || req.body.salarySplit) {
      const company = await prisma.company.findUnique({
        where: { id: existing.companyId },
      });
      const compliance = { ...(company?.compliance || {}) };
      if (data.pfApplicable !== undefined)
        compliance.pfApplicable = data.pfApplicable;
      if (data.esiApplicable !== undefined)
        compliance.esiApplicable = data.esiApplicable;

      if (wantsManual) {
        // manual: use the components exactly as entered, derive deductions,
        // and keep ctcMonthly in step with the manual total
        const structure = buildFromComponents(req.body.salaryComponents, compliance);
        data.salaryStructure = structure;
        data.ctcMonthly = structure.ctc;
      } else {
        data.salaryStructure = computeBreakup(
          data.ctcMonthly ?? existing.ctcMonthly,
          compliance,
          req.body.salarySplit || {}
        );
      }
    }

    const row = await prisma.employee.update({ where: { id }, data, include });
    res.json(toDto(row));
  } catch (e) {
    if (e.code === "P2025")
      return res.status(404).json({ message: "Employee not found" });
    next(e);
  }
};

/** What still stands between this joiner and an active record. */
function blockers(row) {
  const list = [];
  if (!row.fullName?.trim()) list.push("Full name");
  if (!row.dob) list.push("Date of birth");
  if (!row.mobile) list.push("Mobile number");
  if (!row.designation) list.push("Designation");
  if (!row.doj) list.push("Date of joining");
  if (!row.ctcMonthly) list.push("Monthly CTC");
  if (!row.aadhaar) list.push("Aadhaar number");
  if (!row.pan) list.push("PAN");
  if (!row.bankAccountNo) list.push("Bank account number");
  if (!row.bankIfsc) list.push("IFSC");
  if (row.pfApplicable && !row.uan) list.push("UAN");

  const received = new Set(
    (row.documents || [])
      .filter((d) => d.status === "received")
      .map((d) => d.docKey)
  );
  employeeChecklist
    .filter((d) => d.mandatory && !received.has(d.key))
    .forEach((d) => list.push(d.label));

  return list;
}

exports.blockers = async (req, res, next) => {
  try {
    const row = await prisma.employee.findUnique({
      where: { id: Number(req.params.id) },
      include,
    });
    if (!row) return res.status(404).json({ message: "Employee not found" });
    res.json({ blockers: blockers(row) });
  } catch (e) {
    next(e);
  }
};

/** Turn a joiner into an active employee. */
exports.complete = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await prisma.employee.findUnique({ where: { id }, include });
    if (!row) return res.status(404).json({ message: "Employee not found" });

    if (row.joiningStatus === "joined") {
      return res.status(409).json({ message: "This joining is already complete" });
    }

    const pending = blockers(row);
    if (pending.length) {
      return res.status(422).json({
        message: "Some details are still missing",
        blockers: pending,
      });
    }

    const [employee] = await prisma.$transaction([
      prisma.employee.update({
        where: { id },
        data: {
          joiningStatus: "joined",
          joiningStage: "review",
          status: "Active",
          joinedOn: row.doj || new Date(),
        },
        include,
      }),
      prisma.company.update({
        where: { id: row.companyId },
        data: { headcount: { increment: 1 } },
      }),
    ]);

    res.json(toDto(employee));
  } catch (e) {
    next(e);
  }
};

// Re-activate an employee who previously exited (re-joining without a fresh
// registration). Restores Active status and the company headcount.
exports.reactivate = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await prisma.employee.findUnique({ where: { id }, include });
    if (!row) return res.status(404).json({ message: "Employee not found" });
    if (row.status !== "Exited") {
      return res.status(409).json({ message: "Only an exited employee can be re-activated" });
    }

    const [employee] = await prisma.$transaction([
      prisma.employee.update({
        where: { id },
        data: {
          status: "Active",
          joiningStatus: "joined",
          salaryHold: false,
          salaryHoldReason: "",
        },
        include,
      }),
      prisma.company.update({
        where: { id: row.companyId },
        data: { headcount: { increment: 1 } },
      }),
    ]);

    res.json(toDto(employee));
  } catch (e) {
    next(e);
  }
};

exports.withdraw = async (req, res, next) => {
  try {
    const row = await prisma.employee.update({
      where: { id: Number(req.params.id) },
      data: {
        joiningStatus: "withdrawn",
        status: "Onboarding",
        notes: req.body.reason || undefined,
      },
      include,
    });
    res.json(toDto(row));
  } catch (e) {
    if (e.code === "P2025")
      return res.status(404).json({ message: "Employee not found" });
    next(e);
  }
};

// Hold or release an employee's salary (e.g. for a domestic issue). Held
// salary is still computed but excluded from the bank payout.
exports.holdSalary = async (req, res, next) => {
  try {
    const hold = !!req.body.hold;
    const row = await prisma.employee.update({
      where: { id: Number(req.params.id) },
      data: {
        salaryHold: hold,
        salaryHoldReason: hold ? (req.body.reason || "") : "",
      },
      include,
    });
    res.json(toDto(row));
  } catch (e) {
    if (e.code === "P2025")
      return res.status(404).json({ message: "Employee not found" });
    next(e);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await prisma.employee.findUnique({ where: { id } });
    if (!row) return res.status(404).json({ message: "Employee not found" });
    if (row.joiningStatus === "joined") {
      return res.status(409).json({
        message: "This employee has already joined and cannot be deleted",
      });
    }
    await prisma.employee.delete({ where: { id } });
    fs.rmSync(path.join(__dirname, "..", "uploads", "employees", String(id)), {
      recursive: true,
      force: true,
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

// --- documents -------------------------------------------------------------

exports.uploadPhoto = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!req.file) return res.status(400).json({ message: "No image received" });

    const relPath = path
      .join("employees", String(id), req.file.filename)
      .replace(/\\/g, "/");

    // remove the previous photo so old files don't pile up
    const current = await prisma.employee.findUnique({ where: { id } });
    if (current?.photoUrl) {
      fs.rmSync(path.join(__dirname, "..", "uploads", current.photoUrl), {
        force: true,
      });
    }

    const row = await prisma.employee.update({
      where: { id },
      data: { photoUrl: relPath },
      include,
    });
    res.json(toDto(row));
  } catch (e) {
    next(e);
  }
};

exports.uploadDocument = async (req, res, next) => {
  try {
    const employeeId = Number(req.params.id);
    const { docKey } = req.params;

    if (!employeeDocKeys.includes(docKey))
      return res.status(400).json({ message: "Unknown document type" });
    if (!req.file) return res.status(400).json({ message: "No file received" });

    const relPath = path
      .join("employees", String(employeeId), req.file.filename)
      .replace(/\\/g, "/");

    const previous = await prisma.employeeDocument.findUnique({
      where: { employeeId_docKey: { employeeId, docKey } },
    });
    if (previous?.filePath) {
      fs.rmSync(path.join(__dirname, "..", "uploads", previous.filePath), {
        force: true,
      });
    }

    const fields = {
      status: "received",
      fileName: req.file.originalname,
      filePath: relPath,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      receivedOn: new Date(),
    };

    const doc = await prisma.employeeDocument.upsert({
      where: { employeeId_docKey: { employeeId, docKey } },
      update: fields,
      create: { employeeId, docKey, ...fields },
    });

    res.status(201).json({
      docKey,
      status: doc.status,
      file: doc.fileName,
      on: day(doc.receivedOn),
      url: `/uploads/${doc.filePath}`,
      size: doc.fileSize,
    });
  } catch (e) {
    next(e);
  }
};

exports.updateDocument = async (req, res, next) => {
  try {
    const employeeId = Number(req.params.id);
    const { docKey } = req.params;
    const { status } = req.body;

    if (!employeeDocKeys.includes(docKey))
      return res.status(400).json({ message: "Unknown document type" });
    if (!["pending", "received", "na"].includes(status))
      return res.status(400).json({ message: "Invalid status" });

    const data = { status };
    if (status !== "received") {
      const previous = await prisma.employeeDocument.findUnique({
        where: { employeeId_docKey: { employeeId, docKey } },
      });
      if (previous?.filePath) {
        fs.rmSync(path.join(__dirname, "..", "uploads", previous.filePath), {
          force: true,
        });
      }
      Object.assign(data, {
        fileName: null, filePath: null, fileSize: null,
        mimeType: null, receivedOn: null,
      });
    }

    const doc = await prisma.employeeDocument.upsert({
      where: { employeeId_docKey: { employeeId, docKey } },
      update: data,
      create: { employeeId, docKey, ...data },
    });

    res.json({
      docKey,
      status: doc.status,
      file: doc.fileName || "",
      on: day(doc.receivedOn),
      url: doc.filePath ? `/uploads/${doc.filePath}` : "",
      size: doc.fileSize || 0,
    });
  } catch (e) {
    next(e);
  }
};

// --- salary preview --------------------------------------------------------

/** Live breakup for the joining form, before anything is saved. */
exports.previewSalary = async (req, res, next) => {
  try {
    const { companyId, ctcMonthly, salarySplit, pfApplicable, esiApplicable,
      mode, components } = req.body;
    const company = await prisma.company.findUnique({
      where: { id: Number(companyId) },
    });
    const compliance = { ...(company?.compliance || {}) };
    if (pfApplicable !== undefined) compliance.pfApplicable = !!pfApplicable;
    if (esiApplicable !== undefined) compliance.esiApplicable = !!esiApplicable;

    if (mode === "manual") {
      return res.json(buildFromComponents(components || {}, compliance));
    }
    res.json(computeBreakup(Number(ctcMonthly) || 0, compliance, salarySplit || {}));
  } catch (e) {
    next(e);
  }
};
