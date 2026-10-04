// ---------------------------------------------------------------------------
// Payroll engine.
//
// Takes an employee's monthly salary structure and prorates it by the
// attendance summary for the month, then adds overtime, to produce the actual
// figures for one payslip.
//
//   earned = full month amount × payableDays / totalDays
//
// Deductions follow the earned amounts, not the full-month ones, because a
// person on LOP contributes PF/ESI on what they actually earned.
//
// Company-specific rules applied here:
//   • Overtime is paid per hour at a company-set multiple of the normal
//     hourly wage (default 2×).
//   • Professional Tax is skipped in any month the employee earns below the
//     PT threshold (default ₹25,000) — matches the Karnataka nil slab.
//   • Labour Welfare Fund is deducted in December only.
// ---------------------------------------------------------------------------

const round = (n) => Math.round((n || 0) * 100) / 100;
const rupee = (n) => Math.round(n || 0); // statutory amounts are whole rupees

const PT_MIN_GROSS = 25000; // below this monthly earning, no PT
const LWF_MONTH = 12;       // LWF charged in December only

/**
 * @param structure   the employee's salaryStructure (from computeBreakup)
 * @param attendance  { payableDays, lopDays, totalDays, otHours }
 * @param compliance  the company's compliance block + per-employee flags
 * @param options     { month, otRateMultiplier, otRatePerHour, ptMinGross }
 */
function runPayslip(structure = {}, attendance = {}, compliance = {}, options = {}) {
  const month = options.month; // 1..12, needed for LWF
  const totalDays = attendance.totalDays || 30;
  const payableDays = attendance.payableDays ?? totalDays;
  const otHours = attendance.otHours || 0;
  const factor = totalDays > 0 ? payableDays / totalDays : 1;

  const fullBasic = structure.basic || 0;
  const fullHra = structure.hra || 0;
  const fullConveyance = structure.conveyance || 0;
  const fullSpecial = structure.special || 0;
  const fullTravel = structure.travel || 0;
  const fullIncentive = structure.incentive || 0;
  const fullMedical = structure.medical || 0;
  const fullOther = structure.other || 0;

  // --- earnings, prorated by attendance ---
  const basic = rupee(fullBasic * factor);
  const da = rupee((structure.da || 0) * factor);
  const hra = rupee(fullHra * factor);
  const conveyance = rupee(fullConveyance * factor);
  const special = rupee(fullSpecial * factor);
  const travel = rupee(fullTravel * factor);
  const baseIncentive = rupee(fullIncentive * factor);
  const medical = rupee(fullMedical * factor);
  const other = rupee(fullOther * factor);

  // flexible dropdown allowances, prorated
  const extraAllowances = (Array.isArray(structure.allowanceList) ? structure.allowanceList : [])
    .filter((a) => a && a.type && Number(a.amount) > 0)
    .map((a) => ({ type: String(a.type), amount: rupee((a.amount || 0) * factor) }));
  const extraAllowTotal = extraAllowances.reduce((s, a) => s + a.amount, 0);

  // --- overtime: hours × (normal hourly wage × company multiplier) ---
  // Normal hourly wage is based on full basic over 26 days × 8 hours.
  const hourlyBasic = fullBasic / (26 * 8);
  const otMultiplier = options.otRateMultiplier ?? 2;
  const otRate = options.otRatePerHour ?? hourlyBasic * otMultiplier;
  const otAmount = rupee(otHours * otRate);

  // Comp-off: worked off-days credit an extra day's pay (gross ÷ total days each)
  const compOffDays = attendance.compOffDays || 0;
  const compOff = rupee(compOffDays * ((structure.gross || 0) / totalDays));

  // Company may pay OT as Production Incentive instead of a separate OT line.
  const otAsIncentive = !!options.otAsIncentive;
  const overtime = otAsIncentive ? 0 : otAmount;
  const incentive = baseIncentive + (otAsIncentive ? otAmount : 0);

  const salaryGross = basic + da + hra + conveyance + special + travel + incentive + medical + other + extraAllowTotal + overtime + compOff;

  // EL encashment paid this month — a separate earning, NOT part of the PF/ESI/PT base
  const elEncashment = options.elEncashment || 0;

  // --- deductions, on the earned amounts ---
  const {
    pfApplicable = true,
    pfEmployeeRate = 12,
    pfEmployerRate = 13,
    pfWageCeiling = 15000,
    esiApplicable = true,
    esiEmployeeRate = 0.75,
    esiEmployerRate = 3.25,
    esiWageLimit = 21000,
  } = compliance;

  // PF on earned (basic + DA), with per-employee rate / ceiling overrides
  const pfRate = structure.pfRate != null ? Number(structure.pfRate) : pfEmployeeRate;
  const pfEmpRate = structure.pfEmployerRate != null ? Number(structure.pfEmployerRate) : pfEmployerRate;
  const pfCeil = structure.pfUncapped ? Number.MAX_SAFE_INTEGER : pfWageCeiling;
  const pfWage = Math.min(basic + da, pfCeil);
  const employeePf = pfApplicable ? rupee(pfWage * (pfRate / 100)) : 0;
  const employerPf = pfApplicable ? rupee(pfWage * (pfEmpRate / 100)) : 0;

  // ESI eligibility decided on FULL gross, charged on earned gross
  const fullGross = structure.gross || 0;
  const esiDue = esiApplicable && fullGross <= esiWageLimit;
  const employeeEsi = esiDue ? rupee(salaryGross * (esiEmployeeRate / 100)) : 0;
  const employerEsi = esiDue ? rupee(salaryGross * (esiEmployerRate / 100)) : 0;

  // Professional Tax: skip when this month's earning is below the threshold
  const ptMin = options.ptMinGross ?? PT_MIN_GROSS;
  const professionalTax = salaryGross >= ptMin ? (structure.professionalTax || 0) : 0;

  // Labour Welfare Fund: December only
  // LWF (December only): use the company's configured amount, falling back to
  // whatever was stored on the structure, then the ₹20 default.
  const lwfActive = compliance.lwfApplicable || (structure.lwf || 0) > 0;
  const lwfAmount = Number(compliance.lwfAmount) || structure.lwf || 20;
  const lwf = month === LWF_MONTH && lwfActive ? lwfAmount : 0;

  // fixed recoveries carried on the structure (food / transport / uniform),
  // overridden by a month-specific entry when one is supplied for this run.
  const md = options.monthlyDeduction; // { food, transport, uniform, loan, advance } | undefined
  const foodDeduction = md ? (md.food || 0) : (structure.foodDeduction || 0);
  const transportDeduction = md ? (md.transport || 0) : (structure.transportDeduction || 0);
  const uniformDeduction = md ? (md.uniform || 0) : (structure.uniformDeduction || 0);
  const loanDeduction = md ? (md.loan || 0) : 0;
  const advanceDeduction = md ? (md.advance || 0) : 0;
  const otherRecoveries = foodDeduction + transportDeduction + uniformDeduction + loanDeduction + advanceDeduction;

  const totalDeductions =
    employeePf + employeeEsi + professionalTax + lwf + otherRecoveries;
  // total earnings include the encashment; net = earnings − deductions
  const grossEarned = salaryGross + elEncashment;
  const netPay = grossEarned - totalDeductions;

  const gratuity = rupee((structure.gratuity || 0) * factor);
  const employerCost = grossEarned + employerPf + employerEsi + gratuity;

  return {
    payableDays: round(payableDays),
    lopDays: round(attendance.lopDays || 0),
    totalDays,
    otHours: round(otHours),
    compOffDays: compOffDays,
    otRateApplied: round(otRate),

    earnings: {
      basic, da, hra, conveyance, special,
      travel, incentive, medical, other,
      extraAllowances,
      overtime,
      compOff,
      elEncashment,
      gross: grossEarned,
    },
    deductions: {
      pf: employeePf,
      esi: employeeEsi,
      professionalTax,
      lwf,
      food: foodDeduction,
      transport: transportDeduction,
      uniform: uniformDeduction,
      loan: loanDeduction,
      advance: advanceDeduction,
      total: totalDeductions,
    },
    employer: {
      pf: employerPf,
      esi: employerEsi,
      gratuity,
    },

    grossEarned,
    totalDeductions,
    netPay,
    employerCost,
  };
}

module.exports = { runPayslip, PT_MIN_GROSS, LWF_MONTH };
