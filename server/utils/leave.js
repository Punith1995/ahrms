// ---------------------------------------------------------------------------
// Leave types and balances.
//
// Paid leaves (CL/SL/EL) draw down an annual balance and do NOT cut salary —
// in the attendance register they become "PL". Loss of Pay does not touch a
// balance and DOES cut salary — it becomes "A" (absent), which the payroll
// engine already prorates out of pay. So a leave added here flows straight
// into salary through attendance; no separate deduction step is needed.
// ---------------------------------------------------------------------------

const LEAVE_TYPES = [
  { key: "CL",  label: "Casual Leave",    paid: true,  defaultQuota: 12 },
  { key: "SL",  label: "Sick Leave",      paid: true,  defaultQuota: 12 },
  { key: "EL",  label: "Earned Leave",    paid: true,  defaultQuota: 15 },
  { key: "ML",  label: "Maternity Leave", paid: true,  defaultQuota: 0  },
  { key: "LOP", label: "Loss of Pay",     paid: false, defaultQuota: 0  },
];

const PAID_TYPES = LEAVE_TYPES.filter((t) => t.paid);
const TYPE_KEYS = LEAVE_TYPES.map((t) => t.key);
const typeMeta = (key) => LEAVE_TYPES.find((t) => t.key === key);
const isPaidType = (key) => !!typeMeta(key)?.paid;

/** Attendance status a leave of this type should write. */
const attendanceCodeFor = (key) => (isPaidType(key) ? "PL" : "A");

/** Merge a company's saved policy over the defaults. */
function resolvePolicy(saved = {}) {
  const p = {};
  PAID_TYPES.forEach((t) => {
    const v = Number(saved?.[t.key]);
    p[t.key] = Number.isFinite(v) && v >= 0 ? v : t.defaultQuota;
  });
  return p;
}

/**
 * @param policy  resolved quotas { CL, SL, EL }
 * @param records array of { leaveType } for the employee in the year
 */
function computeBalances(policy, records, encashed = {}) {
  const used = Object.fromEntries(TYPE_KEYS.map((k) => [k, 0]));
  records.forEach((r) => {
    if (used[r.leaveType] !== undefined) used[r.leaveType] += 1;
  });

  const balances = PAID_TYPES.map((t) => {
    const enc = encashed[t.key] || 0;
    return {
      key: t.key,
      label: t.label,
      allotted: policy[t.key],
      used: used[t.key],
      encashed: enc,
      remaining: policy[t.key] - used[t.key] - enc,
    };
  });

  return {
    balances,
    lopTaken: used.LOP,
    paidTaken: balances.reduce((s, b) => s + b.used, 0),
  };
}

module.exports = {
  LEAVE_TYPES,
  PAID_TYPES,
  TYPE_KEYS,
  typeMeta,
  isPaidType,
  attendanceCodeFor,
  resolvePolicy,
  computeBalances,
};