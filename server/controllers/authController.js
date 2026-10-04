const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../utils/prisma");

const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";
const TOKEN_TTL = "12h";

function sign(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, role: u.role,
  lastLoginAt: u.lastLoginAt,
});

exports.login = async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await prisma.adminUser.findUnique({ where: { email } });
    // same message whether the email is unknown or the password is wrong,
    // so an attacker can't tell which emails exist
    const ok = user && user.active && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    await prisma.adminUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    res.json({ token: sign(user), user: publicUser(user) });
  } catch (e) {
    next(e);
  }
};

exports.me = async (req, res, next) => {
  try {
    const user = await prisma.adminUser.findUnique({ where: { id: req.user.sub } });
    if (!user || !user.active) {
      return res.status(401).json({ message: "Session no longer valid" });
    }
    res.json({ user: publicUser(user) });
  } catch (e) {
    next(e);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: "New password must be at least 8 characters" });
    }

    const user = await prisma.adminUser.findUnique({ where: { id: req.user.sub } });
    const ok = await bcrypt.compare(String(currentPassword || ""), user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.adminUser.update({ where: { id: user.id }, data: { passwordHash } });

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
