import { handleCallback } from "@vercel/queue";
import { PrismaClient } from "@prisma/client";
import { ConnectorsService } from "../../src/connectors";

const prisma = new PrismaClient();
const connectors = new ConnectorsService();

export default handleCallback(
  async (message: { publishJobId: string }) => {
    const record = await prisma.publishJob.findUnique({
      where: { id: message.publishJobId },
      include: {
        product: {
          include: {
            images: true,
          },
        },
        store: true,
      },
    });

    if (!record) return;

    if (record.status === "COMPLETED") {
      return;
    }

    await prisma.publishJob.update({
      where: { id: record.id },
      data: {
        status: "PROCESSING",
        attempt: {
          increment: 1,
        },
      },
    });

    await prisma.listing.upsert({
      where: {
        productId_storeId: {
          productId: record.productId,
          storeId: record.storeId,
        },
      },
      create: {
        productId: record.productId,
        storeId: record.storeId,
        status: "PUBLISHING",
      },
      update: {
        status: "PUBLISHING",
        errorMessage: null,
      },
    });

    try {
      const result = await connectors.publish(
        record.product,
        record.store,
      );

      await prisma.$transaction([
        prisma.publishJob.update({
          where: { id: record.id },
          data: {
            status: "COMPLETED",
            result: result as any,
            errorMessage: null,
          },
        }),

        prisma.listing.update({
          where: {
            productId_storeId: {
              productId: record.productId,
              storeId: record.storeId,
            },
          },
          data: {
            status: "PUBLISHED",
            externalId: result.externalId,
            publishedAt: new Date(),
            errorMessage: null,
          },
        }),
      ]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.slice(0, 1000)
          : "Marketplace publish failed";

      await prisma.$transaction([
        prisma.publishJob.update({
          where: { id: record.id },
          data: {
            status: "FAILED",
            errorMessage: message,
          },
        }),

        prisma.listing.update({
          where: {
            productId_storeId: {
              productId: record.productId,
              storeId: record.storeId,
            },
          },
          data: {
            status: "FAILED",
            errorMessage: message,
          },
        }),
      ]);

      throw error;
    }
  },
);
