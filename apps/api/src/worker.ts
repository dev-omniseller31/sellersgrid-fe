import { Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { ConnectorsService } from "./connectors";

export const PUBLISH_QUEUE = "marketplace-publishing";

@Injectable()
export class PublishWorker {
  constructor(
    private readonly db: PrismaService,
    private readonly connectors: ConnectorsService,
  ) {}

  async processPublishJob(publishJobId: string) {
    const record = await this.db.publishJob.findUnique({
      where: { id: publishJobId },
      include: {
        product: {
          include: {
            images: true,
          },
        },
        store: true,
      },
    });

    if (!record) {
      return;
    }

    if (record.status === "COMPLETED") {
      return record.result;
    }

    await this.db.publishJob.update({
      where: { id: record.id },
      data: {
        status: "PROCESSING",
        attempt: {
          increment: 1,
        },
      },
    });

    await this.db.listing.upsert({
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
      const result = await this.connectors.publish(
        record.product,
        record.store,
      );

      await this.db.$transaction([
        this.db.publishJob.update({
          where: { id: record.id },
          data: {
            status: "COMPLETED",
            result: result as any,
            errorMessage: null,
          },
        }),

        this.db.listing.update({
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

      return result;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.slice(0, 1000)
          : "Marketplace publish failed";

      await this.db.$transaction([
        this.db.publishJob.update({
          where: { id: record.id },
          data: {
            status: "FAILED",
            errorMessage: message,
          },
        }),

        this.db.listing.update({
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
  }
}
