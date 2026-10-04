// Keep this list in step with client/src/data/checklist.js
const documentChecklist = [
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

const documentKeys = documentChecklist.map((d) => d.key);

module.exports = { documentChecklist, documentKeys };
