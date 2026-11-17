const { execFileSync } = require("node:child_process");

try { process.loadEnvFile(); } catch {}
const env = { ...process.env };
if (!/^postgres(?:ql)?:\/\//.test(env.DATABASE_URL ?? "")) {
  env.DATABASE_URL = env.DATABASE_URL_POSTGRES_PRISMA_URL ?? env.DATABASE_URL_DATABASE_URL ?? env.DATABASE_URL_POSTGRES_URL;
}

if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required");

execFileSync(process.platform === "win32" ? "prisma.cmd" : "prisma", ["migrate", "deploy"], {
  env,
  shell: process.platform === "win32",
  stdio: "inherit",
});
