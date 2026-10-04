// ---------------------------------------------------------------------------
// Salary breakup engine.
//
// Two ways to arrive at a structure:
//   computeBreakup(ctc, ...)        — AUTO: split a monthly CTC into components
//   buildFromComponents(parts, ...) — MANUAL: take components as given
//
// Both return the same shape, tagged with `mode` ("auto" | "manual"), so the
// payroll engine and payslip never need to care which was used.
//
// The same logic runs on the browser for the live preview, but the server
// recomputes on save — client-side numbers are never trusted.
// ---------------------------------------------------------------------------

const round = (n) => Math.round(n || 0);

// Professional tax is a state subject and slabs change with state budgets.
// Verify against the current notification before going live.
const PT_SLABS = {
  Karnataka: [{ upTo: 24999, amount: 0 }, { upTo: Infinity, amount: 200 }],
  Maharashtra: [
    { upTo: 7500, amount: 0 },
    { upTo: 10000, amount: 175 },
    { upTo: Infinity, amount: 200 },
  ],
  Telangana: [
    { upTo: 15000, amount: 0 },
    { upTo: 20000, amount: 150 },
    { upTo: Infinity, amount: 200 },
  ],
  "Andhra Pradesh": [
    { upTo: 15000, amount: 0 },
    { upTo: 20000, amount: 150 },
    { upTo: Infinity, amount: 200 },
  ],
  "Tamil Nadu": [
    { upTo: 21000, amount: 0 },
    { upTo: 30000, amount: 135 },
    { upTo: 45000, amount: 315 },
    { upTo: 60000, amount: 690 },
    { upTo: 75000, amount: 1025 },
    { upTo: Infinity, amount: 1250 },
  ],
  Gujarat: [{ upTo: 11999, amount: 0 }, { upTo: Infinity, amount: 200 }],
};

function professionalTax(gross, state) {
  const slabs = PT_SLABS[state];
  if (!slabs) return 0; // states with no PT, e.g. Delhi, Haryana, UP
  return slabs.find((s) => gross <= s.upTo)?.amount || 0;
}

const DEFAULT_SPLIT = {
  basicPct: 50,
  hraPct: 40,
  conveyance: 1600,
  gratuityApplicable: true,
};

/** Statutory deductions and employer costs for a given set of earnings. */
function statutory(basic, gross, compliance) {
  const {
    pfApplicable = true,
    pfEmployeeRate = 12,
    pfEmployerRate = 13,
    pfWageCeiling = 15000,
    esiApplicable = true,
    esiEmployeeRate = 0.75,
    esiEmployerRate = 3.25,
    esiWageLimit = 21000,
    ptState = "Karnataka",
    lwfApplicable = false,
  } = compliance;

  const pfWage = Math.min(basic, pfWageCeiling);
  const employeePf = pfApplicable ? round(pfWage * (pfEmployeeRate / 100)) : 0;
  const employerPf = pfApplicable ? round(pfWage * (pfEmployerRate / 100)) : 0;

  const esiDue = esiApplicable && gross <= esiWageLimit;
  const employeeEsi = esiDue ? round(gross * (esiEmployeeRate / 100)) : 0;
  const employerEsi = esiDue ? round(gross * (esiEmployerRate / 100)) : 0;

  const professionalTaxAmt = professionalTax(gross, ptState);
  const lwf = lwfApplicable ? (Number(compliance.lwfAmount) || 20) : 0;

  return {
    employeePf, employerPf, employeeEsi, employerEsi,
    professionalTax: professionalTaxAmt, lwf,
    pfWageCeiling, esiWageLimit, pfApplicable, esiApplicable, ptState,
  };
}

/**
 * AUTO. Work backwards from monthly cost to company.
 */
function computeBreakup(ctcMonthly, compliance = {}, split = {}) {
  const ctc = round(ctcMonthly);
  const s = { ...DEFAULT_SPLIT, ...split };

  const {
    pfApplicable = true,
    pfEmployerRate = 13,
    pfWageCeiling = 15000,
    esiApplicable = true,
    esiEmployerRate = 3.25,
    esiWageLimit = 21000,
  } = compliance;

  if (ctc <= 0) {
    return {
      mode: "auto",
      ctc: 0, basic: 0, hra: 0, conveyance: 0, special: 0,
      gross: 0, employerPf: 0, employerEsi: 0, gratuity: 0,
      employeePf: 0, employeeEsi: 0, professionalTax: 0, lwf: 0,
      gratuityApplicable: s.gratuityApplicable,
      totalDeductions: 0, netPay: 0, notes: [],
    };
  }

  const notes = [];

  const basic = round(ctc * (s.basicPct / 100));
  const pfWage = Math.min(basic, pfWageCeiling);

  const employerPf = pfApplicable ? round(pfWage * (pfEmployerRate / 100)) : 0;
  const gratuity = s.gratuityApplicable ? round(basic * 0.0481) : 0;

  let gross = ctc - employerPf - gratuity;
  let employerEsi =
    esiApplicable && gross <= esiWageLimit
      ? round(gross * (esiEmployerRate / 100))
      : 0;
  gross = ctc - employerPf - gratuity - employerEsi;

  const hra = round(basic * (s.hraPct / 100));
  const conveyance = Math.min(s.conveyance, Math.max(0, gross - basic - hra));
  const special = Math.max(0, gross - basic - hra - conveyance);

  const st = statutory(basic, gross, compliance);

  if (pfApplicable && basic > pfWageCeiling) {
    notes.push(
      `PF is calculated on the ceiling of ₹${pfWageCeiling.toLocaleString("en-IN")}, not full basic.`
    );
  }
  if (esiApplicable && gross > esiWageLimit) {
    notes.push(
      `Gross is above the ESI limit of ₹${esiWageLimit.toLocaleString("en-IN")}, so ESI does not apply.`
    );
  }
  if (!PT_SLABS[st.ptState]) {
    notes.push(`${st.ptState} has no professional tax, so nothing is deducted.`);
  }
  if (special === 0 && gross > 0) {
    notes.push("CTC is too low to cover basic, HRA and conveyance in full.");
  }

  const totalDeductions =
    st.employeePf + st.employeeEsi + st.professionalTax + st.lwf;

  return {
    mode: "auto",
    ctc,
    basic, hra, conveyance, special,
    gross,
    employerPf, employerEsi, gratuity,
    employeePf: st.employeePf,
    employeeEsi: st.employeeEsi,
    professionalTax: st.professionalTax,
    lwf: st.lwf,
    gratuityApplicable: s.gratuityApplicable,
    totalDeductions,
    netPay: gross - totalDeductions,
    notes,
  };
}

/**
 * MANUAL. Take earnings exactly as entered, compute the statutory pieces that
 * follow. Gratuity is optional and can be typed (defaults to 4.81% of basic).
 */
function buildFromComponents(parts = {}, compliance = {}) {
  const basic = round(parts.basic);
  const da = parts.daApplicable ? round(parts.da) : 0;
  const hra = round(parts.hra);
  const conveyance = round(parts.conveyance);
  const special = round(parts.special);

  // optional allowances — each on/off like gratuity
  const travel = parts.travelApplicable ? round(parts.travel) : 0;
  const incentive = parts.incentiveApplicable ? round(parts.incentive) : 0;
  const medical = parts.medicalApplicable ? round(parts.medical) : 0;
  const other = parts.otherApplicable ? round(parts.other) : 0;

  // flexible allowances chosen from a dropdown — [{ type, amount }]
  const allowanceList = (Array.isArray(parts.allowanceList) ? parts.allowanceList : [])
    .filter((a) => a && a.type && Number(a.amount) > 0)
    .map((a) => ({ type: String(a.type), amount: round(a.amount) }));
  const extraAllowTotal = allowanceList.reduce((s, a) => s + a.amount, 0);

  const gross = basic + da + hra + conveyance + special + travel + incentive + medical + other + extraAllowTotal;

  // per-employee PF override (double / voluntary / uncapped for seniors)
  const pfRate = parts.pfRate != null && parts.pfRate !== "" ? Number(parts.pfRate) : compliance.pfEmployeeRate;
  const pfEmployerRate = parts.pfEmployerRate != null && parts.pfEmployerRate !== ""
    ? Number(parts.pfEmployerRate) : compliance.pfEmployerRate;
  const pfUncapped = !!parts.pfUncapped;
  const pfCompliance = {
    ...compliance,
    pfEmployeeRate: pfRate,
    pfEmployerRate,
    pfWageCeiling: pfUncapped ? Number.MAX_SAFE_INTEGER : compliance.pfWageCeiling,
  };
  const st = statutory(basic + da, gross, pfCompliance);

  const gratuityApplicable = parts.gratuityApplicable ?? false;
  const gratuity = gratuityApplicable
    ? parts.gratuity != null && parts.gratuity !== ""
      ? round(parts.gratuity)
      : round(basic * 0.0481)
    : 0;

  // fixed recoveries — each on/off, deducted from net (not prorated)
  const foodDeduction = parts.foodApplicable ? round(parts.food) : 0;
  const transportDeduction = parts.transportApplicable ? round(parts.transport) : 0;
  const uniformDeduction = parts.uniformApplicable ? round(parts.uniform) : 0;
  const otherRecoveries = foodDeduction + transportDeduction + uniformDeduction;

  const totalDeductions =
    st.employeePf + st.employeeEsi + st.professionalTax + st.lwf + otherRecoveries;
  const ctc = gross + st.employerPf + st.employerEsi + gratuity;

  const notes = ["Salary is set manually — components are not derived from CTC."];
  if (st.pfApplicable && basic + da > st.pfWageCeiling) {
    notes.push(
      `PF is calculated on the ceiling of ₹${st.pfWageCeiling.toLocaleString("en-IN")}, not full basic.`
    );
  }
  if (st.esiApplicable && gross > st.esiWageLimit) {
    notes.push(
      `Gross is above the ESI limit of ₹${st.esiWageLimit.toLocaleString("en-IN")}, so ESI does not apply.`
    );
  }

  return {
    mode: "manual",
    ctc,
    basic, da, hra, conveyance, special,
    daApplicable: !!parts.daApplicable,
    travel, incentive, medical, other,
    allowanceList,
    pfRate, pfEmployerRate, pfUncapped,
    travelApplicable: !!parts.travelApplicable,
    incentiveApplicable: !!parts.incentiveApplicable,
    medicalApplicable: !!parts.medicalApplicable,
    otherApplicable: !!parts.otherApplicable,
    gross,
    employerPf: st.employerPf,
    employerEsi: st.employerEsi,
    gratuity,
    employeePf: st.employeePf,
    employeeEsi: st.employeeEsi,
    professionalTax: st.professionalTax,
    lwf: st.lwf,
    gratuityApplicable,
    foodDeduction, transportDeduction, uniformDeduction,
    foodApplicable: !!parts.foodApplicable,
    transportApplicable: !!parts.transportApplicable,
    uniformApplicable: !!parts.uniformApplicable,
    food: foodDeduction, transport: transportDeduction, uniform: uniformDeduction,
    totalDeductions,
    netPay: gross - totalDeductions,
    notes,
  };
}

module.exports = {
  computeBreakup,
  buildFromComponents,
  professionalTax,
  PT_SLABS,
  DEFAULT_SPLIT,
};
