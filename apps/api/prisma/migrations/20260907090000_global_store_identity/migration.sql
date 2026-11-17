DROP INDEX "Store_organizationId_marketplace_externalAccountId_key";
CREATE UNIQUE INDEX "Store_marketplace_externalAccountId_key" ON "Store"("marketplace", "externalAccountId");
