# @pmchau2510/nestjs-common

Shared/common building blocks dùng chung cho các NestJS service trong hệ sinh thái We* (WePayment, WGD, WeMasterTrade-CRM, Admin...).

Hạ tầng dùng: **GitHub** (repo cá nhân + GitHub Packages làm npm registry riêng tư), vì chưa có tài khoản Microsoft/Azure DevOps cá nhân. Sau này nếu công ty cấp quyền tạo repo trên Azure DevOps, di dời sang đó chỉ cần đổi lại `registry`/`repository` trong `package.json` và `.npmrc` — code không đổi.

## Đang có gì (v0.0.1 → chưa publish bản mới)

- **`decorators`**
  - `TransformToNumber/Boolean/Array` — class-transformer decorators.
  - `@InjectMethod(Entity)` — param/property decorator, wrapper quanh `@Inject(getMethodToken(Entity))`.
  - `@QueryOptions()` — param decorator đọc `page/skip/limit/sort` từ query string, chuẩn hoá thành `QueryParams`.
- **`errors`**
  - `DomainError` — base class lỗi nghiệp vụ (httpStatus, code, message, metadata).
- **`entities`**
  - `AbstractEntity` — cột audit + soft-delete dùng chung cho entity TypeORM (`createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `deletedAt`). Không khai báo `id` (mỗi entity tự khai PK riêng vì tên constraint khác nhau theo bảng).
- **`method`** — `Method<T>` generic CRUD facade cho TypeORM, đăng ký qua `MethodModule.forFeature([{ entity, tenantColumn?, searchColumns? }])`:
  - `find/findOne/findById` — hỗ trợ `select`, `relations`, `withDeleted`, `search` (ILIKE theo `searchColumns`), `sort` (dot-path vào relation, vd `'company.name'`), `skip/limit`, `idsOnly`.
  - `count/exists/existsAll` (existsAll có `throwCase`: `IF_ONE_EXISTS`/`IF_ONE_NOT_EXISTS`/`IF_ALL_EXISTS`/`IF_ALL_NOT_EXISTS`).
  - `create/update/delete/softDelete/restore/upsert/createInstance`.
  - `paginate` — `{ data, total }`, hỗ trợ `sort`/`search` giống `find`.
  - `createQueryBuilder(alias?)` — escape hatch cho query phức tạp (join nhiều bảng, điều kiện riêng từng bảng), vẫn tự động tenant-scoping + loại soft-delete trên alias gốc.
  - `paginateQueryBuilder(qb, queryParams, alias?)` — áp skip/limit/sort lên 1 `SelectQueryBuilder` bất kỳ.
  - `transaction` — wrapper `repo.manager.transaction()`.
  - `repo` — raw `Repository<T>`, **`@deprecated`**, chỉ dùng khi `createQueryBuilder` không đủ (raw SQL, manager-level ops) — bỏ qua tenant-scoping/soft-delete tự động.
  - Tenant-scoping qua CLS (`nestjs-cls`), **hoàn toàn optional per-entity** — không khai báo `tenantColumn` thì không có logic tenant nào chạy (an toàn cho project không có khái niệm tenant).
- **`logging`** — `ILogger` interface (`trace/debug/info/warn/error/fatal`), `LogLevel` enum, `LogContext` type, `LOGGER_TOKEN` (Symbol) để bind implementation logger thật của từng project (Pino, Winston...) vào 1 token dùng chung.
- **`tracing`** — `TRACE_CLS_KEY`, `HEADER_TRACE_ID`, `HEADER_TRACEPARENT`, `parseTraceparent`/`buildTraceparent` (W3C traceparent thuần), `TraceContextService` (đọc/ghi trace id qua CLS, cùng pattern với `TenantContextService`). **Không** bao gồm `ClsModule.forRoot()` — project tự setup 1 lần (tránh gọi `forRoot({global:true})` 2 lần nếu project đã có sẵn).
- **`exceptions`** — `getExceptionDetails`/`getI18nMessage`/`flattenValidationErrors` (map bất kỳ exception nào → `{status, errorCode, message, data, metadata}`, nhận diện `DomainError`, `IntegrationError`, `I18nValidationException`, `HttpException`, lỗi RPC-style, `Error` thường), `GlobalExceptionFilter` (NestJS `@Catch()` filter dùng các hàm trên + `ILogger` + `TraceContextService`, trả JSON response nhất quán kèm `traceId`).
- **`errors`** (bổ sung) — `IntegrationError`/`IntegrationErrorCode` — wrapper lỗi HTTP call ra ngoài (từ Axios), phân loại theo status (timeout/network/400/401/403/404/429/500).
- **`microservice`** — cặp gửi/nhận cho tracing xuyên TCP/RPC:
  - `TraceAwareClientProxy` — wrapper resilient cho `ClientProxy` (retry+backoff cho lỗi network tạm thời, timeout, tự nhét `traceId` vào `RpcEnvelope` gửi đi, chuẩn hoá lỗi RPC). Nhận `businessErrorSources?: string[]` qua constructor để đánh dấu lỗi nào KHÔNG nên retry (mặc định rỗng — không skip retry cho case nào).
  - `RpcClsInterceptor` — phía nhận: đọc `traceId` từ `RpcEnvelope` payload đến, set vào CLS run mới cho request đang xử lý — dùng `microservice.useGlobalInterceptors(new RpcClsInterceptor(clsService))`.
  - `rpc-error.util.ts`/`rpc-retry.util.ts` — `extractRpcStatus`, `normalizeRpcError`, `isBusinessError`, `isRetryableNetworkError`, `getBackoffDelay`, `backoffTimer`.

Xem chi tiết API/JSDoc trực tiếp trong `src/method/method-factory.ts`, `src/exceptions/*.ts`.

## Chuẩn bị (làm 1 lần trên GitHub)

1. Tạo repo mới trên GitHub: https://github.com/new — tên `Codebase-WE-Global-NestJS-Common`, có thể để **Private**. Không tick "Initialize with README" (đã có sẵn code local).
2. Tạo Personal Access Token: GitHub → Settings → Developer settings → **Personal access tokens** → Tokens (classic) → Generate new token.
   - Scope tối thiểu: `write:packages`, `read:packages` (và `repo` nếu repo Private, vì GitHub Packages cần quyền đọc repo tương ứng).
   - Lưu token lại — chỉ hiện 1 lần.

## Cấu hình publish (GitHub Packages)

```bash
cp .npmrc.example .npmrc
# điền <GH_TOKEN> = personal access token
npm install
npm run build
npm run test
npm version patch   # mỗi lần thêm mảnh mới, bump version trước khi publish
npm publish
```

Nếu `npm publish` báo lỗi 404/403: kiểm tra lại (a) tên package trong `package.json` phải bắt đầu bằng `@pmchau2510/`, (b) token có đủ scope `write:packages`, (c) `publishConfig.registry` trong `package.json` đúng là `https://npm.pkg.github.com`.

## Cài về 1 project tiêu thụ (WePayment_NodeJs / WeMasterTrade_CRM_NodeJS / ...)

```bash
# tại root project tiêu thụ
cp <đường dẫn>/.npmrc.example .npmrc   # KHÔNG commit .npmrc thật lên git
# điền lại <GH_TOKEN>
npm install @pmchau2510/nestjs-common@latest
```

Khi dev/test cục bộ mà chưa muốn publish version mới, dùng `npm link` thay vì cài từ registry (tránh cần `.npmrc`/token):

```bash
# trong Codebase-WE-Global-NestJS-Common
npm run build && npm link

# trong project tiêu thụ
npm link @pmchau2510/nestjs-common
```

Lưu ý: `npm link` nên chạy từ đúng môi trường sẽ chạy build/test (Windows PowerShell hay WSL) — symlink tạo từ môi trường khác đôi khi không tương thích (giống lỗi `.bin` không nhận diện được).

## Peer dependencies cần có ở project tiêu thụ

`@nestjs/common`, `@nestjs/core`, `@nestjs/typeorm`, `typeorm` (`>=0.3.11`, cần `.exists()`), `nestjs-cls` (`>=5`), `class-transformer`, `class-validator`, `axios` (`>=1`, cho `IntegrationError.fromAxios`), `nestjs-i18n` (`>=10`, cho `exceptions`/`GlobalExceptionFilter`). Với `MethodModule`/`tracing`, cần `ClsModule.forRoot({ global: true, ... })` đã được set up ở đâu đó trong app (thường 1 module `SharedClsModule` global) để `ClsService` inject được.

## Ranh giới phạm vi (đọc trước khi thêm bất cứ thứ gì vào package này)

Package này chỉ chứa phần **generic, không phụ thuộc business logic của riêng project nào** (không có `TenantAccessDeniedError`, không có `assertTenantAccess`, không có entity/schema nghiệp vụ cụ thể như Contact/Deal/PaymentMethod, không có enum nghiệp vụ như SystemRole/Gender/AuditFeature) — những phần đó gắn với domain cụ thể của từng service, không nên đưa vào thư viện dùng chung.

Không phụ thuộc alias nội bộ kiểu `@app/*` của bất kỳ project nào — chỉ phụ thuộc npm package công khai.

## Danh sách ứng viên tiếp theo

Xem `openspec/changes/shared-common-library/tasks.md` trong repo `WePayment_NodeJs` — đã audit toàn bộ `WePayment_NodeJs` (tháng 7/2026) và chia thành 3 nhóm: an toàn move ngay, cần cắt bớt phụ thuộc trước khi move, và không nên move (business-specific).
