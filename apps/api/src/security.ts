import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";
import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { PrismaService } from "./prisma.service";

export type SessionUser = { userId: string; organizationId: string; role: "OWNER" | "ADMIN" | "STAFF" | "VIEWER" };
export const Public = () => SetMetadata("public", true);

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly reflector: Reflector, private readonly db: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>("public", [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<Request & { user?: SessionUser }>();
    const token = request.cookies?.marketflow_session;
    if (!token) throw new UnauthorizedException("Sign in required");
    try {
      const claims = this.jwt.verify<SessionUser>(token);
      const membership = await this.db.membership.findUnique({
        where: { userId_organizationId: { userId: claims.userId, organizationId: claims.organizationId } },
        select: { role: true },
      });
      if (!membership) throw new UnauthorizedException("Session expired");
      request.user = { ...claims, role: membership.role };
      return true;
    } catch {
      throw new UnauthorizedException("Session expired");
    }
  }
}

export function encryptionKey(value = process.env.ENCRYPTION_KEY) {
  if (!value) throw new Error("ENCRYPTION_KEY is required");
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes encoded as base64");
  return key;
}

export function encryptJson(value: unknown, key = encryptionKey()) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString("base64url")).join(".");
}

export function decryptJson<T>(value: string, key = encryptionKey()): T {
  const [iv, tag, encrypted] = value.split(".").map(part => Buffer.from(part, "base64url"));
  if (!iv || !tag || !encrypted) throw new Error("Invalid encrypted payload");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")) as T;
}

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
