// Keep in step with server/utils/employeeChecklist.js

export const employeeChecklist = [
  { key: "aadhaar",     label: "Aadhaar card",                      group: "Identity",    mandatory: true,  hint: "Both sides, or the e-Aadhaar PDF" },
  { key: "pan",         label: "PAN card",                          group: "Identity",    mandatory: true,  hint: "" },
  { key: "photo",       label: "Passport photograph",               group: "Identity",    mandatory: true,  hint: "Recent, plain background" },
  { key: "education",   label: "Highest qualification certificate", group: "Background",  mandatory: false, hint: "" },
  { key: "relieving",   label: "Relieving letter",                  group: "Background",  mandatory: false, hint: "Not applicable for freshers" },
  { key: "experience",  label: "Experience letter",                 group: "Background",  mandatory: false, hint: "" },
  { key: "lastPayslip", label: "Last drawn payslip",                group: "Background",  mandatory: false, hint: "Useful for setting the offer" },
  { key: "bankProof",   label: "Cancelled cheque / passbook page",  group: "Banking",     mandatory: true,  hint: "Name, account number and IFSC must be legible" },
  { key: "form11",      label: "Form 11 — PF declaration",          group: "Statutory",   mandatory: true,  hint: "Declares any earlier EPF membership" },
  { key: "form2",       label: "Form 2 — PF nomination",            group: "Statutory",   mandatory: false, hint: "Nominee for PF and pension" },
  // { key: "esicForm1",   label: "ESIC declaration Form 1",           group: "Statutory",   mandatory: false, hint: "Only where ESI applies" },
  { key: "offerLetter", label: "Signed appointment letter",         group: "Appointment", mandatory: true,  hint: "Counter-signed copy" },
  { key: "medical",     label: "Medical fitness certificate",       group: "Appointment", mandatory: false, hint: "Required for factory workers" },
  { key: "police",      label: "Police verification",               group: "Appointment", mandatory: false, hint: "Common for security and facility roles" },
];

export const employeeGroups = [
  "Identity", "Background", "Banking", "Statutory", "Appointment",
];

export const STAGES = [
  { id: "personal",   label: "Personal",        short: "Personal" },
  { id: "employment", label: "Role and pay",    short: "Role" },
  { id: "statutory",  label: "Statutory and bank", short: "Statutory" },
  { id: "documents",  label: "Documents",       short: "Documents" },
  { id: "review",     label: "Review",          short: "Review" },
];

export const stageIndex = (id) =>
  Math.max(0, STAGES.findIndex((s) => s.id === id));

export const departments = [
  "Production", "Quality", "Stores", "Dispatch", "Maintenance",
  "Housekeeping", "Security", "Administration", "Accounts", "Sales", "HR",
  "Executive", "IT", "Others",
];

export const employmentTypes = [
  "Permanent", "Probation", "Contract", "Apprentice", "Trainee", "Consultant",
];

export const shifts = [
  "General (9:00 – 18:00)", "First (6:00 – 14:00)",
  "Second (14:00 – 22:00)", "Third (22:00 – 6:00)", "Rotational",
];

/** Share of the joining checklist that's been collected. "na" rows don't count. */
export function docProgress(employee) {
  const applicable = employeeChecklist.filter(
    (d) => employee?.docs?.[d.key]?.status !== "na"
  );
  if (!applicable.length) return 100;
  const done = applicable.filter(
    (d) => employee.docs[d.key]?.status === "received"
  ).length;
  return Math.round((done / applicable.length) * 100);
}

/** Everything still standing between this joiner and an active record. */
export function pendingItems(e) {
  if (!e) return [];
  const list = [];
  const need = (v, label) => {
    if (!v) list.push(label);
  };

  need(e.fullName?.trim(), "Full name");
  need(e.dob, "Date of birth");
  need(e.mobile, "Mobile number");
  need(e.designation, "Designation");
  need(e.doj, "Date of joining");
  need(e.ctcMonthly, "Monthly CTC");
  need(e.aadhaar, "Aadhaar number");
  need(e.pan, "PAN");
  need(e.bankAccountNo, "Bank account number");
  need(e.bankIfsc, "IFSC");
  if (e.pfApplicable) need(e.uan, "UAN");

  employeeChecklist
    .filter((d) => d.mandatory && e.docs?.[d.key]?.status !== "received")
    .forEach((d) => list.push(d.label));

  return list;
}

export const money = (n) =>
  `₹${Math.round(n || 0).toLocaleString("en-IN")}`;

export function daysSince(iso) {
  if (!iso) return 0;
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}
