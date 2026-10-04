const { PrismaClient } = require("@prisma/client");

// One client for the whole app. Creating a new one per request exhausts
// the Postgres connection pool.
const prisma = new PrismaClient();

module.exports = prisma;
