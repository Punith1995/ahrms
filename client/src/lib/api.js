import axios from "axios";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const TOKEN_KEY = "ahrms_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export const api = axios.create({ baseURL: `${BASE}/api` });

// attach the token to every request
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// on a 401, drop the token and bounce to login
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error?.response?.status === 401) {
      clearToken();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// File downloads/embeds (payslip + report PDFs) open in a new tab where an
// Authorization header can't be sent, so the token rides as a query param.
// The server accepts it either way (see auth middleware note).
export const withToken = (url) => {
  const token = getToken();
  if (!token) return url;
  return url + (url.includes("?") ? "&" : "?") + "access_token=" + encodeURIComponent(token);
};

export const fileUrl = (p) => (p ? `${BASE}${p}` : "");

export const errorText = (e) =>
  e?.response?.data?.message || e?.message || "Something went wrong";

export const authApi = {
  login: (email, password) =>
    api.post("/auth/login", { email, password }).then((r) => r.data),
  me: () => api.get("/auth/me").then((r) => r.data),
  changePassword: (currentPassword, newPassword) =>
    api.post("/auth/change-password", { currentPassword, newPassword }).then((r) => r.data),
};

export const companyApi = {
  list: () => api.get("/companies").then((r) => r.data),
  get: (id) => api.get(`/companies/${id}`).then((r) => r.data),
  create: (body) => api.post("/companies", body).then((r) => r.data),
  update: (id, body) => api.put(`/companies/${id}`, body).then((r) => r.data),
  remove: (id) => api.delete(`/companies/${id}`).then((r) => r.data),
  uploadDocument: (id, docKey, file, { expiresOn, onProgress } = {}) => {
    const fd = new FormData();
    fd.append("file", file);
    if (expiresOn) fd.append("expiresOn", expiresOn);
    return api
      .post(`/companies/${id}/documents/${docKey}`, fd, {
        onUploadProgress: (e) =>
          onProgress?.(Math.round((e.loaded * 100) / (e.total || 1))),
      })
      .then((r) => r.data);
  },
  patchDocument: (id, docKey, body) =>
    api.patch(`/companies/${id}/documents/${docKey}`, body).then((r) => r.data),
  uploadLogo: (id, file) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post(`/companies/${id}/logo`, fd).then((r) => r.data);
  },
};

export const employeeApi = {
  list: (params = {}) => api.get("/employees", { params }).then((r) => r.data),
  get: (id) => api.get(`/employees/${id}`).then((r) => r.data),
  create: (body) => api.post("/employees", body).then((r) => r.data),
  update: (id, body) => api.put(`/employees/${id}`, body).then((r) => r.data),
  remove: (id) => api.delete(`/employees/${id}`).then((r) => r.data),
  blockers: (id) => api.get(`/employees/${id}/blockers`).then((r) => r.data),
  complete: (id) => api.post(`/employees/${id}/complete`).then((r) => r.data),
  withdraw: (id, reason) =>
    api.post(`/employees/${id}/withdraw`, { reason }).then((r) => r.data),
  salaryPreview: (body) =>
    api.post("/employees/salary-preview", body).then((r) => r.data),
  uploadDocument: (id, docKey, file, { onProgress } = {}) => {
    const fd = new FormData();
    fd.append("file", file);
    return api
      .post(`/employees/${id}/documents/${docKey}`, fd, {
        onUploadProgress: (e) =>
          onProgress?.(Math.round((e.loaded * 100) / (e.total || 1))),
      })
      .then((r) => r.data);
  },
  patchDocument: (id, docKey, body) =>
    api.patch(`/employees/${id}/documents/${docKey}`, body).then((r) => r.data),
  uploadPhoto: (id, file) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post(`/employees/${id}/photo`, fd).then((r) => r.data);
  },
  hold: (id, hold, reason) =>
    api.post(`/employees/${id}/hold`, { hold, reason }).then((r) => r.data),
  reactivate: (id) =>
    api.post(`/employees/${id}/reactivate`).then((r) => r.data),
};

export const attendanceApi = {
  month: (companyId, year, month) =>
    api.get("/attendance", { params: { companyId, year, month } }).then((r) => r.data),
  monthAll: (year, month) =>
    api.get("/attendance/all", { params: { year, month } }).then((r) => r.data),
  summary: (companyId, year, month) =>
    api.get("/attendance/summary", { params: { companyId, year, month } }).then((r) => r.data),
  mark: (companyId, cells) =>
    api.post("/attendance/mark", { companyId, cells }).then((r) => r.data),
  clear: (employeeId, date) =>
    api.post("/attendance/clear", { employeeId, date }).then((r) => r.data),
  clearMonth: (companyId, year, month) =>
    api.post("/attendance/clear-month", { companyId, year, month }).then((r) => r.data),
  importCsv: (companyId, year, month, csv) =>
    api.post("/attendance/import", { companyId, year, month, csv }).then((r) => r.data),
  setOt: (companyId, employeeId, year, month, hours) =>
    api.put("/attendance/ot", { companyId, employeeId, year, month, hours }).then((r) => r.data),
  prefill: (companyId, year, month) =>
    api.post("/attendance/prefill", { companyId, year, month }).then((r) => r.data),
  lock: (companyId, year, month, locked) =>
    api.post("/attendance/lock", { companyId, year, month, locked }).then((r) => r.data),
};

export const payrollApi = {
  preview: (companyId, year, month) =>
    api.get("/payroll/preview", { params: { companyId, year, month } }).then((r) => r.data),
  getRun: (companyId, year, month) =>
    api.get("/payroll/run", { params: { companyId, year, month } }).then((r) => r.data),
  run: (companyId, year, month) =>
    api.post("/payroll/run", { companyId, year, month }).then((r) => r.data),
  finalise: (companyId, year, month) =>
    api.post("/payroll/finalise", { companyId, year, month }).then((r) => r.data),
  markPaid: (companyId, year, month) =>
    api.post("/payroll/mark-paid", { companyId, year, month }).then((r) => r.data),
  reopen: (companyId, year, month) =>
    api.post("/payroll/reopen", { companyId, year, month }).then((r) => r.data),
};

export const payslipApi = {
  list: (companyId, year, month) =>
    api.get("/payslips", { params: { companyId, year, month } }).then((r) => r.data),
  pdfUrl: (payslipId, download = false) =>
    withToken(`${BASE}/api/payslips/${payslipId}/pdf${download ? "?download=1" : ""}`),
  bulkUrl: (companyId, year, month) =>
    withToken(`${BASE}/api/payslips/bulk?companyId=${companyId}&year=${year}&month=${month}`),
};

export const exitApi = {
  meta: () => api.get("/exits/meta").then((r) => r.data),
  eligible: (companyId) =>
    api.get("/exits/eligible", { params: { companyId } }).then((r) => r.data),
  list: (params = {}) => api.get("/exits", { params }).then((r) => r.data),
  get: (id) => api.get(`/exits/${id}`).then((r) => r.data),
  create: (body) => api.post("/exits", body).then((r) => r.data),
  update: (id, body) => api.put(`/exits/${id}`, body).then((r) => r.data),
  suggestSettlement: (id, leaveBalanceDays) =>
    api.post(`/exits/${id}/suggest-settlement`, { leaveBalanceDays }).then((r) => r.data),
  complete: (id) => api.post(`/exits/${id}/complete`).then((r) => r.data),
  cancel: (id) => api.delete(`/exits/${id}`).then((r) => r.data),
};

export const leaveApi = {
  meta: () => api.get("/leaves/meta").then((r) => r.data),
  balances: (companyId, year) =>
    api.get("/leaves/balances", { params: { companyId, year } }).then((r) => r.data),
  employee: (employeeId, year) =>
    api.get(`/leaves/employee/${employeeId}`, { params: { year } }).then((r) => r.data),
  add: (body) => api.post("/leaves", body).then((r) => r.data),
  remove: (id) => api.delete(`/leaves/${id}`).then((r) => r.data),
  encash: (employeeId, days, note) =>
    api.post("/leaves/encash", { employeeId, days, note }).then((r) => r.data),
  removeEncash: (id) => api.delete(`/leaves/encash/${id}`).then((r) => r.data),
  getPolicy: (companyId) =>
    api.get("/leaves/policy", { params: { companyId } }).then((r) => r.data),
  setPolicy: (companyId, policy) =>
    api.put("/leaves/policy", { companyId, policy }).then((r) => r.data),
};

export const reportApi = {
  catalog: () => api.get("/reports/catalog").then((r) => r.data),
  preview: (params) => api.get("/reports/preview", { params }).then((r) => r.data),
  exportUrl: (params) => {
    const q = new URLSearchParams(params).toString();
    return withToken(`${BASE}/api/reports/export?${q}`);
  },
};

export const monthlyDeductionApi = {
  list: (companyId, year, month) =>
    api.get("/monthly-deductions", { params: { companyId, year, month } }).then((r) => r.data),
  save: (companyId, year, month, rows) =>
    api.post("/monthly-deductions", { companyId, year, month, rows }).then((r) => r.data),
};

export const registersApi = {
  list: () => api.get("/registers").then((r) => r.data),
  downloadUrl: (id, params) => {
    const q = new URLSearchParams(params).toString();
    return withToken(`${BASE}/api/registers/${id}?${q}`);
  },
};

export const dashboardApi = {
  overview: () => api.get("/dashboard").then((r) => r.data),
};
