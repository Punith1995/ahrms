const path = require("path");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
require("dotenv").config({ quiet: true });

const { requireAuth } = require("./middleware/auth");

const authRoutes = require("./routes/auth");
const companyRoutes = require("./routes/companies");
const employeeRoutes = require("./routes/employees");
const attendanceRoutes = require("./routes/attendance");
const payrollRoutes = require("./routes/payroll");
const payslipRoutes = require("./routes/payslips");
const exitRoutes = require("./routes/exits");
const leaveRoutes = require("./routes/leaves");
const reportRoutes = require("./routes/reports");
const dashboardRoutes = require("./routes/dashboard");


const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => res.send("Ashwija HRMS API running"));

// public — no token needed
app.use("/api/auth", authRoutes);

// everything below requires a valid token
app.use("/api/companies", requireAuth, companyRoutes);
app.use("/api/employees", requireAuth, employeeRoutes);
app.use("/api/attendance", requireAuth, attendanceRoutes);
app.use("/api/payroll", requireAuth, payrollRoutes);
app.use("/api/payslips", requireAuth, payslipRoutes);
app.use("/api/exits", requireAuth, exitRoutes);
app.use("/api/leaves", requireAuth, leaveRoutes);
app.use("/api/reports", requireAuth, reportRoutes);
app.use("/api/dashboard", requireAuth, dashboardRoutes);
app.use("/api/registers", require("./routes/registers"));
app.use("/api/monthly-deductions", require("./routes/monthlyDeductions"));
app.use((req, res) => res.status(404).json({ message: "Route not found" }));


app.use((err, req, res, next) => {
  console.error(err);
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE" ? "File is larger than 10 MB" : "Upload failed";
    return res.status(400).json({ message });
  }
  res.status(err.status || 500).json({
    message: err.message || "Something went wrong on the server",
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
