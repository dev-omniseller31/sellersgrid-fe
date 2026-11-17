import assert from "node:assert/strict";
import test from "node:test";
import { decryptJson, encryptJson, safeEqual } from "./security";
import { apiRequestUrl } from "./routing";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ServiceBriefDto, ServiceDeskController } from "./service-desk.controller";
import { PrismaService } from "./prisma.service";
import type { SessionUser } from "./security";

const owner: SessionUser = { userId: "owner", organizationId: "org-a", role: "OWNER" };
const brief = { service: "IMAGE", title: "Product photography", brief: "Please edit the product backgrounds", marketplace: "FLIPKART", quantity: 2 };

test("service briefs reject unknown services, blank titles and invalid quantities", async () => {
  assert.equal((await validate(plainToInstance(ServiceBriefDto, brief))).length, 0);
  for (const invalid of [{ service: "FAKE" }, { title: "    " }, { quantity: 0 }, { quantity: 1.5 }, { quantity: 1001 }, { marketplace: "UNKNOWN" }]) {
    assert.ok((await validate(plainToInstance(ServiceBriefDto, { ...brief, ...invalid }))).length > 0);
  }
});

test("service request creation takes organization and author from the session", async () => {
  const db = { serviceRequest: { create: async ({ data }: { data: Record<string, unknown> }) => data } } as unknown as PrismaService;
  const desk = new ServiceDeskController(db);
  const record = await desk.create({ user: owner }, brief);
  assert.equal(record.organizationId, "org-a");
  assert.equal(record.createdById, "owner");
  assert.throws(() => desk.create({ user: { ...owner, role: "VIEWER" } }, brief), /Viewers/);
});

test("service detail access is scoped to the current organization", async () => {
  const db = { serviceRequest: { findFirst: async ({ where }: { where: Record<string, unknown> }) => {
    assert.deepEqual(where, { id: "foreign-request", organizationId: "org-a" }); return null;
  } } } as unknown as PrismaService;
  await assert.rejects(new ServiceDeskController(db).detail({ user: owner }, "foreign-request"), /Request not found/);
});

test("staff cannot assign or change service status", async () => {
  const desk = new ServiceDeskController({} as PrismaService);
  await assert.rejects(desk.update({ user: { ...owner, role: "STAFF" } }, "id", { body: "Starting work", status: "IN_PROGRESS", revision: 0 }), /Only owners/);
});

test("service updates reject outsiders and stale revisions before recording activity", async () => {
  const tx = {
    serviceRequest: { findFirst: async () => ({ status: "SUBMITTED" }), updateMany: async () => ({ count: 0 }) },
    membership: { findUnique: async () => null },
    serviceUpdate: { create: async () => { throw Error("Must not record activity"); } },
  };
  const db = { $transaction: async (fn: (value: typeof tx) => unknown) => fn(tx) } as unknown as PrismaService;
  const desk = new ServiceDeskController(db);
  await assert.rejects(desk.update({ user: owner }, "id", { body: "Assign request", assigneeId: "outsider", revision: 0 }), /Assign an editor/);
  await assert.rejects(desk.update({ user: owner }, "id", { body: "Old update", revision: 0 }), /Refresh before saving/);
});

test("Vercel function prefix preserves API paths and query strings", () => {
  assert.equal(apiRequestUrl("/index/api/auth/login"), "/api/auth/login");
  assert.equal(apiRequestUrl("/index/api/products?q=case"), "/api/products?q=case");
  assert.equal(apiRequestUrl("/api/auth/login"), "/api/auth/login");
  assert.equal(apiRequestUrl("/index/other"), "/index/other");
});

test("credential encryption authenticates and round-trips", () => {
  const key = Buffer.alloc(32, 7);
  const encrypted = encryptJson({ token: "secret" }, key);
  assert.deepEqual(decryptJson(encrypted, key), { token: "secret" });
  assert.equal(encrypted.includes("secret"), false);
});

test("constant-time equality rejects different webhook signatures", () => {
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abd"), false);
  assert.equal(safeEqual("short", "longer"), false);
});
