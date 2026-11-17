CREATE TABLE "ServiceRequest" (
 "id" UUID NOT NULL, "organizationId" UUID NOT NULL, "createdById" UUID NOT NULL,
 "service" TEXT NOT NULL, "title" TEXT NOT NULL, "brief" TEXT NOT NULL,
 "marketplace" TEXT NOT NULL, "quantity" INTEGER NOT NULL DEFAULT 1,
 "status" TEXT NOT NULL DEFAULT 'SUBMITTED', "assigneeId" UUID,
 "revision" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ServiceRequest_quantity_check" CHECK ("quantity" BETWEEN 1 AND 1000),
 CONSTRAINT "ServiceRequest_status_check" CHECK ("status" IN ('SUBMITTED','IN_PROGRESS','NEEDS_INPUT','DELIVERED','CLOSED','CANCELLED')),
 CONSTRAINT "ServiceRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "ServiceUpdate" (
 "id" UUID NOT NULL, "requestId" UUID NOT NULL, "authorId" UUID NOT NULL,
 "body" TEXT NOT NULL, "status" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ServiceUpdate_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ServiceUpdate_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ServiceRequest_organizationId_createdAt_idx" ON "ServiceRequest"("organizationId", "createdAt");
CREATE INDEX "ServiceUpdate_requestId_createdAt_idx" ON "ServiceUpdate"("requestId", "createdAt");
