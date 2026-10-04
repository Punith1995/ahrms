// Run with:  node prisma/seed.js
// Safe to run more than once — it clears companies first.

const prisma = require("../utils/prisma");
const { documentKeys } = require("../utils/documentChecklist");

const received = (keys) =>
  documentKeys.map((docKey) => ({
    docKey,
    status: keys[docKey] || "pending",
    fileName: keys[docKey] === "received" ? `${docKey}.pdf` : null,
    receivedOn: keys[docKey] === "received" ? new Date("2024-01-05") : null,
  }));

const companies = [
  {
    code: "NEX",
    name: "Nexa Textiles",
    legalName: "Nexa Textiles Private Limited",
    entityType: "Private Limited",
    industry: "Textile manufacturing",
    status: "Active",
    onboardedOn: new Date("2023-04-01"),
    headcount: 42,
    address: "Plot 14, Peenya Industrial Area, Phase II",
    city: "Bengaluru",
    state: "Karnataka",
    pin: "560058",
    contactPerson: "Sudhir Rao",
    phone: "9845012345",
    email: "accounts@nexatextiles.in",
    registrations: {
      pan: { number: "AAECN1234F", validTill: "" },
      tan: { number: "BLRN01234C", validTill: "" },
      cin: { number: "U17110KA2019PTC123456", validTill: "" },
      gstin: { number: "29AAECN1234F1ZP", validTill: "" },
      shops: { number: "KAR/BLR/SE/2019/44821", validTill: "2026-12-31" },
      factory: { number: "KA/FAC/2020/1187", validTill: "2026-03-31" },
      clra: { number: "", validTill: "" },
      ptr: { number: "PTR2900123456", validTill: "" },
      ptec: { number: "PTEC2900987654", validTill: "" },
      epf: { number: "KNBNG1234567000", validTill: "" },
      esi: { number: "53000123450001099", validTill: "" },
      lwf: { number: "KAR/LWF/2021/8842", validTill: "" },
    },
    bank: {
      accountName: "Nexa Textiles Private Limited",
      bankName: "HDFC Bank",
      branch: "Peenya, Bengaluru",
      accountNo: "50200034567891",
      ifsc: "HDFC0001234",
      transferMode: "NEFT",
    },
    payroll: {
      wagePeriodFrom: 1, wagePeriodTo: 30, salaryDate: 7,
      weeklyOff: "Sunday", holidayCount: 12,
      otApplicable: true, otRate: "2x basic",
      bonusPolicy: "Statutory 8.33% — paid at Deepavali",
      incentiveApplicable: true,
      reimbursementPolicy: "Travel and mobile, against bills, monthly",
      loanRecovery: true,
    },
    compliance: {
      pfApplicable: true, pfEmployerRate: 13, pfEmployeeRate: 12, pfWageCeiling: 15000,
      esiApplicable: true, esiEmployerRate: 3.25, esiEmployeeRate: 0.75, esiWageLimit: 21000,
      ptState: "Karnataka", tdsApplicable: true, lwfApplicable: true,
    },
    authorization: {
      signatoryName: "Sudhir Rao", signatoryDesignation: "Director",
      signatoryEmail: "sudhir@nexatextiles.in",
      hrName: "Kavya Shetty", hrPhone: "9900112233", hrEmail: "hr@nexatextiles.in",
      reportEmails: "accounts@nexatextiles.in, sudhir@nexatextiles.in",
      agreementDate: "2023-03-28",
    },
    docStatus: {
      pan: "received", incorporation: "received", tan: "received",
      gst: "received", ptr: "received", ptec: "pending",
      shops: "received", factory: "received", clra: "na",
      epf: "received", esi: "received", lwf: "pending",
      bank: "received", agreement: "received", poa: "na",
    },
  },
  {
    code: "VER",
    name: "Vertex Logistics",
    legalName: "Vertex Logistics LLP",
    entityType: "LLP",
    industry: "Freight and warehousing",
    status: "Active",
    onboardedOn: new Date("2024-01-10"),
    headcount: 18,
    address: "No. 8, Hosur Road, Bommanahalli",
    city: "Bengaluru",
    state: "Karnataka",
    pin: "560068",
    contactPerson: "Imran Shaikh",
    phone: "9880567123",
    email: "admin@vertexlogistics.co.in",
    registrations: {
      pan: { number: "AAFFV5678K", validTill: "" },
      tan: { number: "", validTill: "" },
      cin: { number: "AAB-1234", validTill: "" },
      gstin: { number: "29AAFFV5678K1Z4", validTill: "" },
      shops: { number: "KAR/BLR/SE/2023/91002", validTill: "2027-03-31" },
      factory: { number: "", validTill: "" },
      clra: { number: "", validTill: "" },
      ptr: { number: "PTR2900556677", validTill: "" },
      ptec: { number: "", validTill: "" },
      epf: { number: "KNBNG7654321000", validTill: "" },
      esi: { number: "", validTill: "" },
      lwf: { number: "", validTill: "" },
    },
    bank: {
      accountName: "Vertex Logistics LLP", bankName: "ICICI Bank",
      branch: "Bommanahalli, Bengaluru", accountNo: "004705001234",
      ifsc: "ICIC0000047", transferMode: "NEFT",
    },
    payroll: {
      wagePeriodFrom: 1, wagePeriodTo: 31, salaryDate: 5,
      weeklyOff: "Sunday", holidayCount: 10,
      otApplicable: true, otRate: "1.5x gross",
      bonusPolicy: "Not applicable", incentiveApplicable: true,
      reimbursementPolicy: "Fuel, against bills", loanRecovery: false,
    },
    compliance: {
      pfApplicable: true, pfEmployerRate: 13, pfEmployeeRate: 12, pfWageCeiling: 15000,
      esiApplicable: false, esiEmployerRate: 3.25, esiEmployeeRate: 0.75, esiWageLimit: 21000,
      ptState: "Karnataka", tdsApplicable: true, lwfApplicable: false,
    },
    authorization: {
      signatoryName: "Imran Shaikh", signatoryDesignation: "Designated Partner",
      signatoryEmail: "imran@vertexlogistics.co.in",
      hrName: "Deepa Menon", hrPhone: "9741220098",
      hrEmail: "deepa@vertexlogistics.co.in",
      reportEmails: "admin@vertexlogistics.co.in",
      agreementDate: "2024-01-08",
    },
    docStatus: {
      pan: "received", incorporation: "received", tan: "pending",
      gst: "received", ptr: "received", ptec: "pending",
      shops: "received", factory: "na", clra: "na",
      epf: "received", esi: "na", lwf: "na",
      bank: "received", agreement: "received", poa: "pending",
    },
  },
  {
    code: "SFS",
    name: "Suraksha Facility Services",
    legalName: "Suraksha Facility Services Pvt Ltd",
    entityType: "Private Limited",
    industry: "Housekeeping and security",
    status: "Active",
    onboardedOn: new Date("2022-08-16"),
    headcount: 76,
    address: "3rd Floor, Sneha Complex, Mysore Road",
    city: "Bengaluru",
    state: "Karnataka",
    pin: "560026",
    contactPerson: "Latha Prakash",
    phone: "9448778812",
    email: "payroll@surakshafs.in",
    registrations: {
      pan: { number: "AAGCS9012M", validTill: "" },
      tan: { number: "BLRS09012E", validTill: "" },
      cin: { number: "U74999KA2016PTC098765", validTill: "" },
      gstin: { number: "29AAGCS9012M1ZQ", validTill: "" },
      shops: { number: "KAR/BLR/SE/2016/22119", validTill: "2026-06-30" },
      factory: { number: "", validTill: "" },
      clra: { number: "CLRA/KA/2021/3390", validTill: "2026-09-30" },
      ptr: { number: "PTR2900443322", validTill: "" },
      ptec: { number: "PTEC2900112233", validTill: "" },
      epf: { number: "KNBNG4455667000", validTill: "" },
      esi: { number: "53000998770001088", validTill: "" },
      lwf: { number: "KAR/LWF/2018/1120", validTill: "" },
    },
    bank: {
      accountName: "Suraksha Facility Services Pvt Ltd",
      bankName: "State Bank of India", branch: "Mysore Road, Bengaluru",
      accountNo: "38812004567", ifsc: "SBIN0040112", transferMode: "NEFT",
    },
    payroll: {
      wagePeriodFrom: 26, wagePeriodTo: 25, salaryDate: 10,
      weeklyOff: "Rotational", holidayCount: 10,
      otApplicable: true, otRate: "2x basic",
      bonusPolicy: "Statutory 8.33% — paid annually in April",
      incentiveApplicable: false, reimbursementPolicy: "Not applicable",
      loanRecovery: true,
    },
    compliance: {
      pfApplicable: true, pfEmployerRate: 13, pfEmployeeRate: 12, pfWageCeiling: 15000,
      esiApplicable: true, esiEmployerRate: 3.25, esiEmployeeRate: 0.75, esiWageLimit: 21000,
      ptState: "Karnataka", tdsApplicable: true, lwfApplicable: true,
    },
    authorization: {
      signatoryName: "Latha Prakash", signatoryDesignation: "Managing Director",
      signatoryEmail: "latha@surakshafs.in",
      hrName: "Manjunath B", hrPhone: "9535667788", hrEmail: "manju@surakshafs.in",
      reportEmails: "payroll@surakshafs.in, latha@surakshafs.in",
      agreementDate: "2022-08-12",
    },
    docStatus: Object.fromEntries(documentKeys.map((k) => [k, "received"])),
  },
];

async function main() {
  await prisma.companyDocument.deleteMany();
  await prisma.company.deleteMany();

  for (const { docStatus, ...company } of companies) {
    await prisma.company.create({
      data: { ...company, documents: { create: received(docStatus) } },
    });
    console.log(`seeded ${company.name}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
