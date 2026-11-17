import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, MinLength } from "class-validator";

export class RegisterDto {
  @IsString() @Length(2, 80) name: string;
  @IsEmail() @MaxLength(200) @Transform(({ value }) => String(value).trim().toLowerCase()) email: string;
  @IsString() @MinLength(10) @MaxLength(128) password: string;
  @IsString() @Length(2, 100) organizationName: string;
}
export class LoginDto {
  @IsEmail() @Transform(({ value }) => String(value).trim().toLowerCase()) email: string;
  @IsString() @MaxLength(128) password: string;
}
export class ProductDto {
  @IsString() @Length(2, 180) name: string;
  @IsString() @Length(2, 80) sku: string;
  @IsString() @MaxLength(10000) description: string;
  @IsOptional() @IsString() @MaxLength(100) brand?: string;
  @IsString() @Length(2, 100) category: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(999999999) price: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(100000000) stock: number;
  @IsOptional() @IsObject() attributes?: Record<string, unknown>;
}
export class PublishDto { @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @IsUUID("4", { each: true }) storeIds: string[]; }
export class RetryDto { @IsUUID() jobId: string; }
export class StoreCredentialsDto {
  @IsIn(["SHOPIFY", "EBAY", "AMAZON", "FLIPKART"]) marketplace: "SHOPIFY" | "EBAY" | "AMAZON" | "FLIPKART";
  @IsString() @Length(2, 100) name: string;
  @IsOptional() @IsString() @MaxLength(200) externalAccountId?: string;
  @IsObject() credentials: Record<string, string>;
  @IsOptional() @IsObject() settings?: Record<string, unknown>;
}
export class UpdateInventoryDto { @Type(() => Number) @IsInt() @Min(0) @Max(100000000) stock: number; }
export class OrderStatusDto { @IsIn(["UNFULFILLED", "PROCESSING", "FULFILLED", "CANCELLED"]) status: "UNFULFILLED" | "PROCESSING" | "FULFILLED" | "CANCELLED"; }
export class SettingsDto { @IsString() @Length(2, 100) organizationName: string; @IsOptional() @IsString() @MaxLength(50) timezone?: string; }
export class OAuthStartDto { @IsString() @Length(3, 100) @Matches(/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/) shop: string; }
