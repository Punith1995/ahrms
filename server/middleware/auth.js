const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";

/**
 * Rejects any request without a valid token.
 * Normally the token arrives in the Authorization header. File downloads that
 * open in a new browser tab (payslip and report PDFs) can't set headers, so a
 * token in ?access_token= is accepted too.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : null;
  const token = bearer || req.query.access_token;
  if (!token) {
    return res.status(401).json({ message: "Not signed in" });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Session expired — please sign in again" });
  }
}

module.exports = { requireAuth };
