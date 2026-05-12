import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const databaseUrl = process.env.INTEGRATION_DATABASE_URL || "file:./test.db";

const adapter = new PrismaLibSql({ url: databaseUrl });
export const prisma = new PrismaClient({ adapter });
