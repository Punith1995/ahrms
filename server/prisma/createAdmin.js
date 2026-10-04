// Create (or reset) the admin login.
//   node prisma/createAdmin.js "Admin Name" admin@ashwija.com YourPassword123
// If run without arguments, sensible defaults are used and printed.

const bcrypt = require("bcryptjs");
const prisma = require("../utils/prisma");

async function main() {
  const [, , nameArg, emailArg, passwordArg] = process.argv;

  const name = nameArg || "Ashwija Admin";
  const email = (emailArg || "admin@ashwija.com").trim().toLowerCase();
  const password = passwordArg || "Ashwija@2026";

  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash, name, active: true },
    create: { name, email, passwordHash, role: "admin" },
  });

  console.log("\nAdmin ready:");
  console.log("  email    :", user.email);
  console.log("  password :", password);
  console.log("\nSign in with these, then change the password from the app.\n");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
