import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, RawBodyRequest, Req, Res, StreamableFile, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { AppService } from "./app.service";
import { LoginDto, OAuthStartDto, OrderStatusDto, ProductDto, PublishDto, RegisterDto, SettingsDto, StoreCredentialsDto, UpdateInventoryDto } from "./api.dto";
import { Public, SessionUser } from "./security";

type AuthedRequest = Request & { user: SessionUser };

@Controller()
export class AppController {
  constructor(private readonly service: AppService) {}
  @Public() @Get("health") health() { return { status: "ok", time: new Date().toISOString() }; }
  @Public() @Throttle({ default: { limit: 8, ttl: 60_000 } }) @Post("auth/register") register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) { return this.service.register(dto, res); }
  @Public() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @Post("auth/login") login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) { return this.service.login(dto.email, dto.password, res); }
  @Post("auth/logout") logout(@Res({ passthrough: true }) res: Response) { return this.service.logout(res); }
  @Get("auth/me") me(@Req() req: AuthedRequest) { return this.service.me(req.user); }
  @Get("dashboard") dashboard(@Req() req: AuthedRequest) { return this.service.dashboard(req.user); }

  @Get("products") products(@Req() req: AuthedRequest, @Query("q") q = "") { return this.service.listProducts(req.user, q.slice(0, 100)); }
  @Get("products/:id") product(@Req() req: AuthedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { return this.service.getProduct(req.user, id); }
  @Post("products") createProduct(@Req() req: AuthedRequest, @Body() dto: ProductDto) { return this.service.createProduct(req.user, dto); }
  @Patch("products/:id") updateProduct(@Req() req: AuthedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() dto: ProductDto) { return this.service.updateProduct(req.user, id, dto); }
  @Delete("products/:id") archiveProduct(@Req() req: AuthedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { return this.service.archiveProduct(req.user, id); }
  @Patch("products/:id/inventory") updateInventory(@Req() req: AuthedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() dto: UpdateInventoryDto) { return this.service.updateInventory(req.user, id, dto.stock); }
  @Post("products/:id/images") @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024, files: 1 } })) upload(@Req() req: AuthedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @UploadedFile() file: Express.Multer.File) { return this.service.uploadImage(req.user, id, file); }
  @Get("images/:id") async image(@Req() req: AuthedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Res({ passthrough: true }) res: Response) { const file = await this.service.image(req.user, id); res.set({ "Content-Type": file.image.mimeType, "Content-Length": file.image.size, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosn" }); return new StreamableFile(file.data); }

  @Get("stores") stores(@Req() req: AuthedRequest) { return this.service.listStores(req.user); }
  @Post("stores/connect") connectStore(@Req() req: AuthedRequest, @Body() dto: StoreCredentialsDto) { return this.service.connectStore(req.user, dto); }
  @Post("stores/oauth/shopify/start") shopifyOAuthStart(@Req() req: AuthedRequest, @Body() dto: OAuthStartDto) { return this.service.shopifyOAuthStart(req.user, dto.shop); }
  @Public() @Get("stores/oauth/shopify/callback") async shopifyOAuthCallback(@Query() query: Record<string, unknown>, @Res() res: Response) { await this.service.shopifyOAuthCallback(query); return res.redirect(`${process.env.APP_ORIGIN ?? "http://localhost:3000"}/dashboard?connected=shopify`); }
  @Delete("stores/:id") disconnectStore(@Req() req: AuthedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { return this.service.disconnectStore(req.user, id); }
  @Public() @Post("webhooks/shopify") shopifyWebhook(@Req() req: RawBodyRequest<Request>) { return this.service.shopifyWebhook(req.rawBody, req.headers); }

  @Post("products/:id/validate") validate(@Req() req: AuthedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() dto: PublishDto) { return this.service.validatePublish(req.user, id, dto.storeIds); }
  @Post("products/:id/publish") publish(@Req() req: AuthedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() dto: PublishDto) { return this.service.publish(req.user, id, dto.storeIds); }
  @Get("publish-jobs") jobs(@Req() req: AuthedRequest) { return this.service.listJobs(req.user); }
  @Post("publish-jobs/:id/retry") retry(@Req() req: AuthedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { return this.service.retryJob(req.user, id); }
  @Get("orders") orders(@Req() req: AuthedRequest) { return this.service.listOrders(req.user); }
  @Patch("orders/:id") orderStatus(@Req() req: AuthedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() dto: OrderStatusDto) { return this.service.setOrderStatus(req.user, id, dto.status); }
  @Get("analytics") analytics(@Req() req: AuthedRequest) { return this.service.analytics(req.user); }
  @Patch("settings") settings(@Req() req: AuthedRequest, @Body() dto: SettingsDto) { return this.service.updateSettings(req.user, dto); }
  @Get("products-export.csv") @Header("Content-Type", "text/csv; charset=utf-8") @Header("Content-Disposition", "attachment; filename=marketflow-products.csv") async export(@Req() req: AuthedRequest) { const rows = await this.service.listProducts(req.user); const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"','""')}"`; return ["Name,SKU,Category,Price,Stock,Status", ...rows.map(p => [p.name,p.sku,p.category,p.price,p.stock,p.status].map(esc).join(","))].join("\n"); }
}
