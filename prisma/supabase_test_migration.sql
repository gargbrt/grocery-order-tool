-- Translated from prisma/schema.prisma for direct testing against Supabase.
-- Uses uuid (gen_random_uuid()) instead of Prisma's cuid() for IDs - functionally
-- equivalent (globally unique, DB-generated), just a different ID format. If you
-- later run `prisma db push` from the actual app, Prisma will manage this instead;
-- this migration exists purely so we can verify the schema and logic against a
-- real database right now.

create extension if not exists pgcrypto;

create type role as enum ('OWNER', 'HELPER');
create type channel as enum ('WHATSAPP', 'TELEGRAM', 'MANUAL', 'MCP');
create type order_status as enum ('RECEIVED','ASSIGNED','FULFILLING','BILLED','VERIFIED','DELIVERED','CANCELLED');
create type payment_status as enum ('UNPAID','PARTIAL','PAID','CREDIT');
create type item_availability as enum ('PENDING','AVAILABLE','UNAVAILABLE','SUBSTITUTED');

create table "Store" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  "whatsappMode" text not null default 'MANUAL',
  "whatsappPhoneNumberId" text,
  "whatsappAccessToken" text,
  "whatsappVerifyToken" text,
  "telegramBotToken" text,
  "telegramBotUsername" text,
  "paymentsModuleEnabled" boolean not null default false,
  "razorpayKeyId" text,
  "createdAt" timestamptz not null default now()
);

create table "User" (
  id uuid primary key default gen_random_uuid(),
  "storeId" uuid not null references "Store"(id),
  name text not null,
  phone text not null unique,
  "passwordHash" text not null,
  role role not null,
  "canViewPricing" boolean not null default false,
  "canViewContactDetails" boolean not null default false,
  "createdAt" timestamptz not null default now()
);

create table "Contact" (
  id uuid primary key default gen_random_uuid(),
  "storeId" uuid not null references "Store"(id),
  "homeLabel" text not null,
  address text,
  phone text not null,
  "telegramChatId" text,
  "whatsappWaId" text,
  notes text,
  "createdAt" timestamptz not null default now(),
  unique ("storeId", phone)
);

create table "CatalogItem" (
  id uuid primary key default gen_random_uuid(),
  "storeId" uuid not null references "Store"(id),
  name text not null,
  unit text,
  price double precision not null,
  "inStock" boolean not null default true,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("storeId", name)
);

create table "Order" (
  id uuid primary key default gen_random_uuid(),
  "storeId" uuid not null references "Store"(id),
  "contactId" uuid references "Contact"(id),
  channel channel not null,
  "rawMessage" text not null,
  status order_status not null default 'RECEIVED',
  "isLikelyOrder" boolean not null default true,
  "flagReason" text,
  "assignedToId" uuid references "User"(id),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table "OrderItem" (
  id uuid primary key default gen_random_uuid(),
  "orderId" uuid not null references "Order"(id),
  "itemName" text not null,
  "quantityRequested" text not null default '',
  "quantityFulfilled" text,
  "unitPrice" double precision,
  "lineTotal" double precision,
  availability item_availability not null default 'PENDING',
  "substitutionNote" text,
  "sortOrder" int not null default 0
);

create table "Bill" (
  id uuid primary key default gen_random_uuid(),
  "orderId" uuid not null unique references "Order"(id),
  subtotal double precision not null,
  discount double precision not null default 0,
  total double precision not null,
  "paymentStatus" payment_status not null default 'UNPAID',
  "paymentMode" text,
  "razorpayPaymentLink" text,
  "razorpayPaymentId" text,
  "finalizedAt" timestamptz not null default now()
);

create table "LedgerEntry" (
  id uuid primary key default gen_random_uuid(),
  "contactId" uuid not null references "Contact"(id),
  "billId" uuid,
  amount double precision not null,
  "runningBalance" double precision not null,
  note text,
  "createdAt" timestamptz not null default now()
);

create table "PriceOverride" (
  id uuid primary key default gen_random_uuid(),
  "storeId" uuid not null references "Store"(id),
  "contactId" uuid not null references "Contact"(id),
  "itemName" text not null,
  price double precision not null,
  "updatedAt" timestamptz not null default now(),
  unique ("contactId", "itemName")
);

create table "AuditLog" (
  id uuid primary key default gen_random_uuid(),
  "orderId" uuid references "Order"(id),
  "userId" uuid references "User"(id),
  action text not null,
  detail text,
  "createdAt" timestamptz not null default now()
);

-- Indexes on foreign keys, added after Supabase's performance advisor flagged
-- these as unindexed (verified against a real project - see conversation).
-- Prisma's db push will create these automatically from the @@index directives
-- in schema.prisma; kept here too so this file stays a faithful standalone copy.
create index if not exists "idx_user_storeId" on "User" ("storeId");
create index if not exists "idx_contact_storeId" on "Contact" ("storeId");
create index if not exists "idx_order_storeId" on "Order" ("storeId");
create index if not exists "idx_order_contactId" on "Order" ("contactId");
create index if not exists "idx_order_assignedToId" on "Order" ("assignedToId");
create index if not exists "idx_orderitem_orderId" on "OrderItem" ("orderId");
create index if not exists "idx_ledgerentry_contactId" on "LedgerEntry" ("contactId");
create index if not exists "idx_priceoverride_storeId" on "PriceOverride" ("storeId");
create index if not exists "idx_auditlog_orderId" on "AuditLog" ("orderId");
create index if not exists "idx_auditlog_userId" on "AuditLog" ("userId");
create index if not exists "idx_catalogitem_storeId" on "CatalogItem" ("storeId");
