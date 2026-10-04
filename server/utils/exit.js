// ---------------------------------------------------------------------------
// Exit / full & final settlement helpers.
// ---------------------------------------------------------------------------

// Standard clearance items for a departing employee. Not all apply to every
// company, so the UI lets you tick only what's relevant.
const CLEARANCE_ITEMS = [
  { key: "idCard",     label: "ID card returned",              group: "Assets" },
  { key: "assets",     label: "Laptop / tools / uniform returned", group: "Assets" },
  { key: "accessCard", label: "Access card / keys returned",   group: "Assets" },
  { key: "handover",   label: "Work handover completed",       group: "Work" },
  { key: "knowledge",  label: "Knowledge transfer done",       group: "Work" },
  { key: "itRevoke",   label: "Email / system access revoked", group: "IT" },
  { key: "advances",   label: "Advances / loans settled",      group: "Accounts" },
  { key: "reimburse",  label: "Pending reimbursements cleared", group: "Accounts" },
  { key: "pfForm",     label: "PF withdrawal / transfer form",  group: "Statutory" },
  { key: "exitForm",   label: "Exit interview / form signed",  group: "HR" },
];

const CLEARANCE_KEYS = CLEARANCE_ITEMS.map((c) => c.key);

const EXIT_TYPES = [
  "Resignation", "Termination", "End of contract", "Retirement", "Absconding",
];

const round = (n) => Math.round((n || 0) * 100) / 100;
const rupee = (n) => Math.round(n || 0);

/** Whole months of completed service between two dates. */
function monthsOfService(doj, lwd) {
  if (!doj || !lwd) return 0;
  const a = new Date(doj);
  const b = new Date(lwd);
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  return Math.max(0, months);
}

function yearsOfService(doj, lwd) {
  return monthsOfService(doj, lwd) / 12;
}

/**
 * Payment of Gratuity Act: 15 days' wages per completed year, on the last
 * drawn basic (+DA). Payable only after 5 years of continuous service.
 * Formula: basic × 15/26 × years.
 */
function computeGratuity(basicMonthly, doj, lwd) {
  const years = yearsOfService(doj, lwd);
  if (years < 5) return { eligible: false, years: round(years), amount: 0 };
  const rounded = Math.round(years); // >= .5 rounds up per convention
  const amount = rupee((basicMonthly * 15 * rounded) / 26);
  return { eligible: true, years: round(years), amount };
}

/** Leave encashment on gross: balanceDays × (grossMonthly / 30). */
function computeLeaveEncashment(balanceDays, grossMonthly) {
  if (!balanceDays || balanceDays <= 0) return 0;
  return rupee(balanceDays * (grossMonthly / 30));
}

/** Notice shortfall recovery on gross: shortfallDays × (grossMonthly / 30). */
function computeNoticeRecovery(requiredDays, servedDays, grossMonthly) {
  const shortfall = Math.max(0, (requiredDays || 0) - (servedDays || 0));
  if (!shortfall) return 0;
  return rupee(shortfall * (grossMonthly / 30));
}

/** Sum the components into a net settlement figure. */
function settle(parts) {
  const earnings =
    (parts.pendingSalary || 0) +
    (parts.leaveEncashment || 0) +
    (parts.gratuity || 0) +
    (parts.bonus || 0) +
    (parts.otherEarnings || 0);
  const deductions =
    (parts.noticeRecovery || 0) +
    (parts.loanRecovery || 0) +
    (parts.otherDeductions || 0);
  return {
    totalEarnings: rupee(earnings),
    totalDeductions: rupee(deductions),
    netSettlement: rupee(earnings - deductions),
  };
}

module.exports = {
  CLEARANCE_ITEMS,
  CLEARANCE_KEYS,
  EXIT_TYPES,
  monthsOfService,
  yearsOfService,
  computeGratuity,
  computeLeaveEncashment,
  computeNoticeRecovery,
  settle,
};
