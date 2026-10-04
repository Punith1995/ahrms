// Keep this list in step with client/src/data/employeeChecklist.js
const employeeChecklist = [
  { key: "aadhaar",     label: "Aadhaar card",                     group: "Identity",    mandatory: true },
  { key: "pan",         label: "PAN card",                         group: "Identity",    mandatory: true },
  { key: "photo",       label: "Passport photograph",              group: "Identity",    mandatory: true },
  { key: "education",   label: "Highest qualification certificate",group: "Background",  mandatory: false },
  { key: "relieving",   label: "Relieving letter",                 group: "Background",  mandatory: false },
  { key: "experience",  label: "Experience letter",                group: "Background",  mandatory: false },
  { key: "lastPayslip", label: "Last drawn payslip",               group: "Background",  mandatory: false },
  { key: "bankProof",   label: "Cancelled cheque / passbook page", group: "Banking",     mandatory: true },
  { key: "form11",      label: "Form 11 — PF declaration",         group: "Statutory",   mandatory: true },
  { key: "form2",       label: "Form 2 — PF nomination",           group: "Statutory",   mandatory: false },
  { key: "esicForm1",   label: "ESIC declaration Form 1",          group: "Statutory",   mandatory: false },
  { key: "offerLetter", label: "Signed appointment letter",        group: "Appointment", mandatory: true },
  { key: "medical",     label: "Medical fitness certificate",      group: "Appointment", mandatory: false },
  { key: "police",      label: "Police verification",              group: "Appointment", mandatory: false },
];

const employeeGroups = ["Identity", "Background", "Banking", "Statutory", "Appointment"];
const employeeDocKeys = employeeChecklist.map((d) => d.key);

module.exports = { employeeChecklist, employeeGroups, employeeDocKeys };
