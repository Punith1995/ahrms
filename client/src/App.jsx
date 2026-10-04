import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./lib/auth";
import Login from "./pages/Login";
import DashboardLayout from "./layouts/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Companies from "./pages/Companies";
import CompanyDetail from "./pages/CompanyDetail";
import Employees from "./pages/Employees";
import EmployeeDetail from "./pages/EmployeeDetail";
import Attendance from "./pages/Attendance";
import Leaves from "./pages/Leaves";
import Salary from "./pages/Salary";
import Payslips from "./pages/Payslips";
import Joining from "./pages/Joining";
import JoiningDetail from "./pages/JoiningDetail";
import Exit from "./pages/Exit";
import ExitDetail from "./pages/ExitDetail";
import Reports from "./pages/Reports";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <div className="text-sm text-slate-400">Loading…</div>
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <DashboardLayout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="companies" element={<Companies />} />
        <Route path="companies/:id" element={<CompanyDetail />} />
        <Route path="employees" element={<Employees />} />
        <Route path="employees/:id" element={<EmployeeDetail />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="leaves" element={<Leaves />} />
        <Route path="salary" element={<Salary />} />
        <Route path="payslips" element={<Payslips />} />
        <Route path="joining" element={<Joining />} />
        <Route path="joining/:id" element={<JoiningDetail />} />
        <Route path="exit" element={<Exit />} />
        <Route path="exit/:id" element={<ExitDetail />} />
        <Route path="reports" element={<Reports />} />
      </Route>
    </Routes>
  );
}
