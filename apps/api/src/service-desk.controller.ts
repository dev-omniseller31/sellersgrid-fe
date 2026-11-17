import { Body, ConflictException, Controller, ForbiddenException, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Req } from "@nestjs/common";
import { Transform } from "class-transformer";
import { IsIn, IsInt, IsString, IsUUID, Length, Max, Min, ValidateIf } from "class-validator";
import { PrismaService } from "./prisma.service";
import { SessionUser } from "./security";
import { serviceCatalog, serviceMarkets, servicePackages, serviceStatuses } from "./service-catalog";

const trim = ({ value }: { value: unknown }) => typeof value === "string" ? value.trim() : value;
export class ServiceBriefDto {
  @IsIn(serviceCatalog.map(s => s.id)) service: string;
  @IsString() @Transform(trim) @Length(3, 140) title: string;
  @IsString() @Transform(trim) @Length(10, 6000) brief: string;
  @IsIn(serviceMarkets) marketplace: string;
  @IsInt() @Min(1) @Max(1000) quantity: number;
}
export class ServiceUpdateDto {
  @IsString() @Transform(trim) @Length(3, 4000) body: string;
  @ValidateIf((_o, v) => v !== undefined) @IsIn(serviceStatuses) status?: string;
  @ValidateIf((_o, v) => v !== undefined && v !== null) @IsUUID("4") assigneeId?: string | null;
  @IsInt() @Min(0) revision: number;
}
type Authed = { user: SessionUser };
export function assertServiceEditor(user: SessionUser) {
  if (user.role === "VIEWER") throw new ForbiddenException("Viewers cannot change service requests");
}
export function assertServiceManager(user: SessionUser) {
  if (!["OWNER", "ADMIN"].includes(user.role)) throw new ForbiddenException("Only owners and admins can assign requests or change their status");
}

@Controller("service-desk")
export class ServiceDeskController {
  constructor(private readonly db: PrismaService) {}

  @Get("catalog") catalog() { return { services: serviceCatalog, markets: serviceMarkets, statuses: serviceStatuses, packages: servicePackages }; }

  @Get("members") members(@Req() { user }: Authed) {
    return this.db.membership.findMany({ where: { organizationId: user.organizationId }, select: { role: true, user: { select: { id: true, name: true } } } });
  }

  @Get("requests") async list(@Req() { user }: Authed, @Query("page") rawPage = "1") {
    const page = Number(rawPage);
    const current = Number.isInteger(page) && page > 0 && page <= 10000 ? page : 1;
    const where = { organizationId: user.organizationId };
    const [items, total] = await Promise.all([
      this.db.serviceRequest.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (current - 1) * 20, take: 20 }),
      this.db.serviceRequest.count({ where }),
    ]);
    return { items, total, page: current };
  }

  @Post("requests") create(@Req() { user }: Authed, @Body() dto: ServiceBriefDto) {
    assertServiceEditor(user);
    return this.db.serviceRequest.create({ data: { ...dto, organizationId: user.organizationId, createdById: user.userId } });
  }

  @Get("requests/:id") async detail(@Req() { user }: Authed, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    const record = await this.db.serviceRequest.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!record) throw new NotFoundException("Request not found");
    return { ...record, updates: await this.db.serviceUpdate.findMany({ where: { requestId: id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 }) };
  }

  @Patch("requests/:id") async update(@Req() { user }: Authed, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() dto: ServiceUpdateDto) {
    assertServiceEditor(user);
    if (dto.status !== undefined || dto.assigneeId !== undefined) assertServiceManager(user);
    return this.db.$transaction(async tx => {
      const record = await tx.serviceRequest.findFirst({ where: { id, organizationId: user.organizationId } });
      if (!record) throw new NotFoundException("Request not found");
      if (dto.assigneeId) {
        const member = await tx.membership.findUnique({ where: { userId_organizationId: { userId: dto.assigneeId, organizationId: user.organizationId } } });
        if (!member || member.role === "VIEWER") throw new ForbiddenException("Assign an editor from this workspace");
      }
      const status = dto.status ?? record.status;
      const changed = await tx.serviceRequest.updateMany({ where: { id, organizationId: user.organizationId, revision: dto.revision }, data: { status, ...(dto.assigneeId !== undefined ? { assigneeId: dto.assigneeId } : {}), revision: { increment: 1 } } });
      if (changed.count !== 1) throw new ConflictException("This request changed. Refresh before saving again.");
      await tx.serviceUpdate.create({ data: { requestId: id, authorId: user.userId, body: dto.body, status } });
      return { ok: true };
    });
  }
}
