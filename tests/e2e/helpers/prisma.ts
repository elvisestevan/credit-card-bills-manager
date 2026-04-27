import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

export function createPrismaClient(dbUrl: string) {
  const adapter = new PrismaLibSql({ url: dbUrl });
  return new PrismaClient({ adapter });
}