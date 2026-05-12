import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const DB_URL = process.env.INTEGRATION_DATABASE_URL || "file:./test.db";

export async function setup(): Promise<void> {
  execSync("bun --bun run prisma db push", {
    env: { ...process.env, DATABASE_URL: DB_URL },
    cwd: process.cwd(),
    stdio: "inherit",
  });
}

export async function teardown(): Promise<void> {
  const match = DB_URL.match(/^file:(.+)$/);
  if (match) {
    const dbPath = path.resolve(process.cwd(), match[1]);
    for (const suffix of ["", "-journal", "-wal", "-shm"]) {
      try {
        fs.unlinkSync(dbPath + suffix);
      } catch {
        // file may not exist
      }
    }
  }
}
