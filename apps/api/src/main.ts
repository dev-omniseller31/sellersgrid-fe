import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import type { Request, Response, NextFunction } from "express";
import { AppModule } from "./app.module";
import { apiRequestUrl } from "./routing";

async function bootstrap() {
  if (!/^postgres(?:ql)?:\/\//.test(process.env.DATABASE_URL ?? "")) {
    process.env.DATABASE_URL = process.env.DATABASE_URL_POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL_DATABASE_URL ?? process.env.DATABASE_URL_POSTGRES_URL;
  }
  for (const name of ["DATABASE_URL", "JWT_SECRET", "ENCRYPTION_KEY"]) if (!process.env[name]) throw new Error(`${name} is required`);
  if ((process.env.JWT_SECRET?.length ?? 0) < 32) throw new Error("JWT_SECRET must be at least 32 characters");
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.getHttpAdapter().getInstance().disable("x-powered-by");
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.url = apiRequestUrl(req.url);
    next();
  });
  app.setGlobalPrefix("api");
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } } }));
  app.use(cookieParser());
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !req.path.startsWith("/api/webhooks/")) {
      const origin = req.get("origin");
      if (origin !== process.env.APP_ORIGIN || (req.get("x-sellersgrid-request") !== "web" && req.get("x-marketflow-request") !== "web")) return res.status(403).json({ message: "Request origin rejected" });
    }
    next();
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, stopAtFirstError: true }));
  if (process.env.NODE_ENV !== "production" || process.env.ENABLE_OPENAPI === "true") {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle("MarketFlow API").setVersion("1.0").addCookieAuth("marketflow_session").build());
    app.getHttpAdapter().get("/api/openapi.json", (_req: Request, res: Response) => res.json(document));
  }
  await app.listen(Number(process.env.API_PORT ?? 4000), process.env.API_HOST ?? "127.0.0.1");
}
void bootstrap();
