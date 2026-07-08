# @pmchau2510/nestjs-common

Shared/common building blocks dùng chung cho các NestJS service trong hệ sinh thái We* (WePayment, WGD, WeMasterTrade-CRM, Admin...).

Đây là bản "walking skeleton" — chỉ chứa 2 mảnh nhỏ nhất, ít rủi ro nhất, để verify trọn đường ống (build → publish → cài về dùng thử) trước khi di dời tiếp các phần khác:

- `decorators` — `TransformToNumber/Boolean/Array` (class-transformer decorators).
- `errors` — `DomainError` base class.

Hạ tầng dùng: **GitHub** (repo cá nhân + GitHub Packages làm npm registry riêng tư), vì chưa có tài khoản Microsoft/Azure DevOps cá nhân. Sau này nếu công ty cấp quyền tạo repo trên Azure DevOps, di dời sang đó chỉ cần đổi lại `registry`/`repository` trong `package.json` và `.npmrc` — code không đổi.

## Chuẩn bị (làm 1 lần trên GitHub)

1. Tạo repo mới trên GitHub: https://github.com/new — tên `Codebase-WE-Global-NestJS-Common`, có thể để **Private**. Không tick "Initialize with README" (đã có sẵn code local).
2. Tạo Personal Access Token: GitHub → Settings → Developer settings → **Personal access tokens** → Tokens (classic) → Generate new token.
   - Scope tối thiểu: `write:packages`, `read:packages` (và `repo` nếu repo Private, vì GitHub Packages cần quyền đọc repo tương ứng).
   - Lưu token lại — chỉ hiện 1 lần.

## Push code lên GitHub

```bash
cd Codebase-WE-Global-NestJS-Common
git init
git add .
git commit -m "chore: scaffold walking skeleton for shared nestjs common lib"
git branch -M main
git remote add origin https://github.com/pmchau2510/Codebase-WE-Global-NestJS-Common.git
git push -u origin main
```

## Cấu hình publish (GitHub Packages)

```bash
cp .npmrc.example .npmrc
# điền <GH_TOKEN> = personal access token vừa tạo
npm install
npm run build
npm run test
npm publish
```

Nếu `npm publish` báo lỗi 404/403: kiểm tra lại (a) tên package trong `package.json` phải bắt đầu bằng `@pmchau2510/`, (b) token có đủ scope `write:packages`, (c) `publishConfig.registry` trong `package.json` đúng là `https://npm.pkg.github.com`.

## Cài về WePayment để test

Trong repo `WePayment_NodeJs` (chỉ tạm thời, **không commit** `.npmrc` thật lên git):

```bash
# tại root WePayment_NodeJs
cp <đường dẫn>/.npmrc.example .npmrc   # hoặc tự tạo, cùng nội dung
# điền lại <GH_TOKEN>
npm install @pmchau2510/nestjs-common@0.0.1
```

Sau đó thử thay 1 import trong WePayment, ví dụ trong 1 DTO đang dùng `TransformToNumber` từ `@app/shared/decorators`, đổi sang import từ `@pmchau2510/nestjs-common`, build + chạy test của app đó để xác nhận hoạt động giống hệt.

## Sau khi walking skeleton chạy ổn

Di dời tiếp các phần còn lại theo `openspec/changes/shared-common-library/tasks.md` của repo WePayment — mỗi lần thêm 1 mảnh vào package này, bump version (`npm version patch`), `npm publish`, rồi cập nhật version trong các repo tiêu thụ.

**Lưu ý phạm vi**: package này chỉ chứa phần **generic, không phụ thuộc business logic của riêng WePayment** (không có `TenantAccessDeniedError`, không có `assertTenantAccess`, không có entity/schema nghiệp vụ) — những phần đó gắn với domain cụ thể của từng service, không nên đưa vào thư viện dùng chung cho tất cả project.
