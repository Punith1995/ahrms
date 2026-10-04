// ---------------------------------------------------------------------------
// Attendance status codes and the monthly summary payroll consumes.
//
// A payslip prorates gross by payableDays / totalDays, so getting this
// summary right is what makes salary correct. Same logic used by the
// register UI and the payroll run.
// ---------------------------------------------------------------------------

// weight = how much of a day counts as PAID for salary
const STATUS = {
  P:  { label: "Present",     weight: 1,   paid: true },
  WO: { label: "Weekly off",  weight: 1,   paid: true },
  H:  { label: "Holiday",     weight: 1,   paid: true },
  PL: { label: "Paid leave",  weight: 1,   paid: true },
  HD: { label: "Half day",    weight: 0.5, paid: true },  // other half is LOP
  CO: { label: "Comp-off",    weight: 1,   paid: true },  // worked an off-day → +1 extra day
  A:  { label: "Absent (LOP)",weight: 0,   paid: false },
};

const STATUS_CODES = Object.keys(STATUS);
const isValidStatus = (s) => STATUS_CODES.includes(s);

const daysInMonth = (year, month) => new Date(year, month, 0).getDate();

/**
 * @param marks   array of { date: 'YYYY-MM-DD', status }
 * @param year, month, totalDays
 * @param otHours monthly overtime total
 */
function summarize(marks, { year, month, otHours = 0 }) {
  const total = daysInMonth(year, month);
  const count = { P: 0, A: 0, WO: 0, H: 0, PL: 0, HD: 0, CO: 0 };

  marks.forEach((m) => {
    if (count[m.status] !== undefined) count[m.status] += 1;
  });

  const marked =
    count.P + count.A + count.WO + count.H + count.PL + count.HD + count.CO;
  const unmarked = Math.max(0, total - marked);

  // paid portion of the month (CO keeps the day whole, like a worked WO)
  const payableDays =
    count.P + count.WO + count.H + count.PL + count.CO + count.HD * 0.5;
  const lopDays = count.A + count.HD * 0.5;

  return {
    totalDays: total,
    presentDays: count.P,
    absentDays: count.A,
    weeklyOffDays: count.WO,
    holidayDays: count.H,
    paidLeaveDays: count.PL,
    halfDays: count.HD,
    compOffDays: count.CO,
    payableDays: Math.round(payableDays * 100) / 100,
    lopDays: Math.round(lopDays * 100) / 100,
    otHours: Math.round((otHours || 0) * 100) / 100,
    unmarked,
    complete: unmarked === 0,
  };
}

/** JS getDay() values that are weekly offs, from the employee's setting. */
function weeklyOffDays(weeklyOff) {
  switch (weeklyOff) {
    case "Sunday":
      return [0];
    case "Saturday and Sunday":
      return [0, 6];
    default:
      return []; // rotational / alternate handled manually
  }
}

module.exports = {
  STATUS,
  STATUS_CODES,
  isValidStatus,
  daysInMonth,
  summarize,
  weeklyOffDays,
};
