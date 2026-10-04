// Labels and grouping for the company document checklist.
// Keep in step with server/utils/documentChecklist.js

export const documentChecklist = [
  { key: "pan",           label: "Company PAN",                        group: "Identity",      mandatory: true },
  { key: "incorporation", label: "Certificate of incorporation",       group: "Identity",      mandatory: true },
  { key: "tan",           label: "TAN allotment letter",               group: "Identity",      mandatory: true },
  { key: "gst",           label: "GST certificate",                    group: "Tax",           mandatory: false },
  { key: "ptr",           label: "Professional tax — PTR",             group: "Tax",           mandatory: false },
  { key: "ptec",          label: "Professional tax — PTEC",            group: "Tax",           mandatory: false },
  { key: "shops",         label: "Shops & establishment registration", group: "Labour",        mandatory: true },
  { key: "factory",       label: "Factory licence",                    group: "Labour",        mandatory: false },
  { key: "clra",          label: "Labour licence (CLRA)",              group: "Labour",        mandatory: false },
  { key: "tradeLicense",  label: "Trade licence",                      group: "Labour",        mandatory: false },
  { key: "foodLicense",   label: "Food licence (FSSAI)",               group: "Labour",        mandatory: false },
  { key: "epf",           label: "EPF registration certificate",       group: "Statutory",     mandatory: true },
  { key: "esi",           label: "ESI registration certificate",       group: "Statutory",     mandatory: false },
  { key: "lwf",           label: "LWF registration",                   group: "Statutory",     mandatory: false },
  { key: "bank",          label: "Cancelled cheque / bank proof",      group: "Banking",       mandatory: true },
  { key: "agreement",     label: "Signed payroll service order",       group: "Authorization", mandatory: true },
  { key: "poa",           label: "Authorisation letter / POA",         group: "Authorization", mandatory: false },
];

export const documentGroups = [
  "Identity", "Tax", "Labour", "Statutory", "Banking", "Authorization",
];

/** Documents that carry an expiry date worth tracking. */
export const expiringDocs = ["shops", "factory", "clra", "tradeLicense", "foodLicense"];

export const states = [
  "Karnataka", "Maharashtra", "Tamil Nadu", "Telangana", "Kerala",
  "Andhra Pradesh", "Gujarat", "Delhi", "Haryana", "Uttar Pradesh",
];

/** Percentage of applicable documents that are on file. "na" rows don't count. */
export function readiness(company) {
  const applicable = documentChecklist.filter(
    (d) => company?.docs?.[d.key]?.status !== "na"
  );
  if (!applicable.length) return 100;
  const received = applicable.filter(
    (d) => company.docs[d.key]?.status === "received"
  ).length;
  return Math.round((received / applicable.length) * 100);
}

/** Mandatory documents still missing (a doc marked Not Applicable is not missing). */
export function missingMandatory(company) {
  return documentChecklist.filter(
    (d) =>
      d.mandatory &&
      company?.docs?.[d.key]?.status !== "received" &&
      company?.docs?.[d.key]?.status !== "na"
  );
}

export const entityTypes = [
  "Private Limited", "Public Limited", "LLP",
  "Partnership", "Proprietorship", "Trust / Society",
];
