# 🗺️ SUBSENTRY — MASTER IMPLEMENTATION PLAN

**Kế Hoạch Tổng Thể Triển Khai Dự Án (Từ Đặc Tả → Go-Live)** | _Chia theo Epic → Task → Subtask_

**Document Version:** 1.0 | **Status:** Draft — chờ phê duyệt trước khi bắt đầu Phase 0

---

## 0. Cách Đọc Tài Liệu Này

- Mỗi **Epic** (Giai đoạn lớn) tương ứng với một cấu phần kiến trúc trong [techspec.md](techspec.md) / [model-c4.md](model-c4.md).
- Mỗi **Task** là một hạng mục triển khai cụ thể, có thể giao cho 1 người/1 buổi làm việc.
- Mỗi **Subtask** là một checklist item nhỏ, kèm tài liệu tham chiếu (nguồn sự thật) để tránh làm sai đặc tả.
- Ký hiệu độ ưu tiên: 🔴 Bắt buộc (Blocker) | 🟡 Quan trọng | 🟢 Có thể làm sau (Nice-to-have).
- Ký hiệu quy mô công việc: `S` (~0.5 ngày) | `M` (~1-2 ngày) | `L` (~3-5 ngày).

---

## 1. Bảng Tổng Quan Các Epic (Roadmap Summary)

| #   | Epic                                                   | Phụ thuộc          | Ưu tiên | Tài liệu tham chiếu                                                              |
| --- | ------------------------------------------------------ | ------------------ | ------- | -------------------------------------------------------------------------------- |
| 0   | Chuẩn bị nền tảng (Bootstrap)                          | —                  | 🔴      | [setup-and-ops-guide.md](setup-and-ops-guide.md)                                 |
| 1   | Lớp dữ liệu (Data Layer)                               | Epic 0             | 🔴      | [model-erd.md](model-erd.md)                                                     |
| 2   | Core Architecture & Shared Kernel                      | Epic 0, 1          | 🔴      | [techspec.md](techspec.md)                                                       |
| 3   | Feature: AI Parser                                     | Epic 2             | 🔴      | [sdd.md](sdd.md)                                                                 |
| 4   | Feature: Subscription State Machine                    | Epic 2, 3          | 🔴      | [sdd.md](sdd.md), [business-rules.md](business-rules.md)                         |
| 5   | Feature: Tiered Alerts                                 | Epic 4             | 🔴      | [business-rules.md](business-rules.md), [model-flowchart.md](model-flowchart.md) |
| 6   | Tích hợp Zalo OA                                       | Epic 3, 4          | 🔴      | [sdd.md](sdd.md)                                                                 |
| 7   | Tích hợp Facebook Messenger                            | Epic 3, 4          | 🟡      | [sdd.md](sdd.md)                                                                 |
| 8   | Tích hợp Cloudflare Email Routing                      | Epic 3             | 🔴      | [model-c4.md](model-c4.md)                                                       |
| 9   | Đồng bộ Google Sheets (2-way)                          | Epic 1, 4          | 🟡      | [business-rules.md](business-rules.md)                                           |
| 10  | Admin & Ops Endpoint                                   | Epic 9             | 🟡      | [disaster-recovery-fallback.md](disaster-recovery-fallback.md)                   |
| 11  | Frontend React SPA (Zalo Mini App / Messenger Webview) | Epic 6, 7          | 🟡      | [techspec.md](techspec.md), [model-c4.md](model-c4.md)                           |
| 12  | Bảo mật & Tuân thủ                                     | Epic 6, 7, 8, 10   | 🔴      | [sdd.md](sdd.md) §4, [business-rules.md](business-rules.md) BR-09                |
| 13  | Testing & Quality Gates                                | Song song mọi Epic | 🔴      | [test-cases-specification.md](test-cases-specification.md)                       |
| 14  | Disaster Recovery & Backup                             | Epic 1, 9          | 🟡      | [disaster-recovery-fallback.md](disaster-recovery-fallback.md)                   |
| 15  | Family Onboarding & Go-Live                            | Tất cả Epic trên   | 🔴      | [family-onboarding-guide.md](family-onboarding-guide.md)                         |
| 16  | Vận hành & Cải tiến liên tục                           | Sau Go-Live        | 🟢      | [prd.md](prd.md), [problem-definition.md](problem-definition.md)                 |

---

## Epic 0 — Chuẩn Bị Nền Tảng (Bootstrap) 🔴

### Task 0.1 — Khởi tạo Monorepo `M`

- [x] 0.1.1 Tạo repo Git, cấu trúc `apps/backend`, `apps/frontend`, `.husky/` (theo [setup-and-ops-guide.md](setup-and-ops-guide.md) §2.1).

- [x] 0.1.2 Tạo `package.json` gốc với Yarn Workspaces (`apps/backend`, `apps/frontend`).
- [x] 0.1.3 Chạy `yarn install` xác nhận workspace liên kết đúng.
- [x] 0.1.4 Khởi tạo `apps/backend/package.json` với tên `@subsentry/backend`.
- [x] 0.1.5 Khởi tạo `apps/frontend/package.json` với tên `@subsentry/frontend`.

### Task 0.2 — Cấu hình Tooling Chất Lượng `M`

- [x] 0.2.1 Cài & cấu hình ESLint v9 Flat Config (`eslint.config.js`).

- [x] 0.2.2 Cài & cấu hình Prettier (`.prettierrc`).
- [x] 0.2.3 Cài `jscpd` (`jscpd.json`, ngưỡng trùng lặp tối đa 5%).
- [x] 0.2.4 Cài `knip` (`knip.json`) để quét dead code.
- [x] 0.2.5 Khởi tạo Husky (`npx husky init`) và viết `.husky/pre-commit` theo chuỗi: format → lint → jscpd → knip → vitest.
- [x] 0.2.6 Chạy thử `git commit` để xác nhận hook chặn đúng khi có lỗi cố ý.

### Task 0.3 — Khởi Tạo Tài Nguyên Cloudflare `M`

- [ ] 0.3.1 Tạo Cloudflare D1 database `subsentry-db`, lấy `database_id`.

- [ ] 0.3.2 Tạo `apps/backend/wrangler.toml` (binding `DB`, cron `0 1 * * *` = 8h sáng VN — xem [setup-and-ops-guide.md](setup-and-ops-guide.md) §4.1).
- [ ] 0.3.3 Tạo Cloudflare Pages project cho `apps/frontend`.
- [ ] 0.3.4 Xác minh `wrangler whoami` và quyền truy cập account đúng.

### Task 0.4 — Cấu Hình Secrets 🔴 `S`

- [ ] 0.4.1 `wrangler secret put OPENAI_API_KEY`

- [ ] 0.4.2 `wrangler secret put ZALO_ACCESS_TOKEN`
- [ ] 0.4.3 `wrangler secret put ZALO_APP_SECRET` (dùng để verify chữ ký webhook — xem [sdd.md](sdd.md) §4.1)
- [ ] 0.4.4 `wrangler secret put MESSENGER_PAGE_ACCESS_TOKEN`
- [ ] 0.4.5 `wrangler secret put MESSENGER_APP_SECRET` (xem [sdd.md](sdd.md) §4.2)
- [ ] 0.4.6 `wrangler secret put GOOGLE_SHEETS_API_KEY`
- [ ] 0.4.7 `wrangler secret put ADMIN_API_TOKEN` (bảo vệ endpoint `/api/admin/reconcile-sync`)
- [ ] 0.4.8 Ghi chú toàn bộ secrets vào trình quản lý mật khẩu cá nhân (KHÔNG commit vào git).

### Task 0.5 — Khung CI/CD Ban Đầu `S`

- [ ] 0.5.1 Tạo `.github/workflows/deploy.yml` theo mẫu ở [setup-and-ops-guide.md](setup-and-ops-guide.md) §6.

- [ ] 0.5.2 Thêm GitHub Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- [ ] 0.5.3 Chạy thử pipeline trên nhánh nháp (chưa bật deploy) để xác nhận bước lint/test chạy được.

**✅ Definition of Done Epic 0:** `yarn install`, `yarn lint`, `yarn test`, `wrangler d1 execute ... --command "SELECT 1"` đều chạy thành công; pre-commit hook hoạt động; toàn bộ secret đã được set.

---

## Epic 1 — Lớp Dữ Liệu (Data Layer) 🔴

### Task 1.1 — Định Nghĩa Drizzle Schema `M`

- [ ] 1.1.1 Bảng `members` (role: ADMIN | SUBSCRIBER | CARD_OWNER) — [model-erd.md](model-erd.md) §2.1.

- [ ] 1.1.2 Bảng `payment_cards` (chỉ `card_label` + `last_four`, **không** PAN/CVV — tuân thủ BR-09 trong [business-rules.md](business-rules.md)).
- [ ] 1.1.3 Bảng `subscriptions` (status, billing_cycle, confidence_score, is_must_keep...).
- [ ] 1.1.4 Bảng `alerts` (alert_type: SOFT_T3 | RED_T24, response: PENDING|KEEP|KILL).
- [ ] 1.1.5 Bảng `parsing_logs` (status: SUCCESS|LOW_CONFIDENCE|FAILED).
- [ ] 1.1.6 Review chéo schema với [model-erd.md](model-erd.md) để đảm bảo khớp 100% kiểu dữ liệu & ràng buộc FK.

### Task 1.2 — Migrations `S`

- [ ] 1.2.1 `drizzle-kit generate` sinh file SQL migration.

- [ ] 1.2.2 Áp dụng migration local: `wrangler d1 migrations apply subsentry-db --local`.
- [ ] 1.2.3 Áp dụng migration remote (môi trường staging trước, production sau).
- [ ] 1.2.4 Viết script kiểm tra migration idempotent (chạy lại không lỗi).

### Task 1.3 — Seed Data Cho Test `S`

- [ ] 1.3.1 Seed 2-3 `members` mẫu (1 ADMIN, 2 SUBSCRIBER).

- [ ] 1.3.2 Seed 1-2 `payment_cards` mẫu.
- [ ] 1.3.3 Seed vài `subscriptions` ở các trạng thái khác nhau (TRIAL, ACTIVE, PENDING_KILL, KILLED) để dùng cho test Cron.

### Task 1.4 — Unit Test Ràng Buộc Dữ Liệu `S`

- [ ] 1.4.1 Test FK constraint (không cho tạo subscription với `subscriber_id` không tồn tại).

- [ ] 1.4.2 Test enum constraint cho `status`, `role`, `billing_cycle`.
- [ ] 1.4.3 Test default values (`is_must_keep = false`, `currency = 'VND'`).

**✅ DoD Epic 1:** Toàn bộ 5 bảng có migration chạy sạch trên local & remote; seed script chạy lặp lại an toàn; test constraint pass 100%.

---

## Epic 2 — Core Architecture & Shared Kernel 🔴

### Task 2.1 — Khung Hono App `M`

- [ ] 2.1.1 Khởi tạo `src/index.ts` với Hono app + router gốc.

- [ ] 2.1.2 Middleware xử lý lỗi tập trung (`core/errors`), trả JSON chuẩn hóa.
- [ ] 2.1.3 Middleware logging request (ẩn dữ liệu nhạy cảm khỏi log).
- [ ] 2.1.4 Cấu trúc thư mục `src/core`, `src/features/{subscription,alert,parser}` theo [techspec.md](techspec.md) §2.1.

### Task 2.2 — DB Client Wrapper `S`

- [ ] 2.2.1 Tạo `core/db/client.ts` khởi tạo Drizzle từ `env.DB`.

- [ ] 2.2.2 Export schema tập trung để các feature dùng chung.

### Task 2.3 — Shared Types/DTOs `S`

- [ ] 2.3.1 Định nghĩa type `SubscriptionExtraction` (khớp JSON Schema ở [sdd.md](sdd.md) §3.1).

- [ ] 2.3.2 Định nghĩa enum dùng chung: `SubscriptionStatus`, `AlertType`, `MemberRole`.

**✅ DoD Epic 2:** Worker chạy `yarn backend:dev` trả về `200 OK` ở route health-check; cấu trúc thư mục khớp Clean Architecture.

---

## Epic 3 — Feature: AI Parser (Bóc Tách Hóa Đơn) 🔴

### Task 3.1 — Domain & Interface `S`

- [ ] 3.1.1 Entity `ParsingLog`, interface `IParserService.parse(input): Promise<SubscriptionExtraction>`.

### Task 3.2 — Adapter OpenAI Client `M`

- [ ] 3.2.1 Gọi OpenAI GPT-4o-mini với `response_format: { type: "json_object" }`.

- [ ] 3.2.2 Áp JSON Schema strict theo [sdd.md](sdd.md) §3.1 (merchant, amount, currency, is_trial, next_billing_date, confidence_score).
- [ ] 3.2.3 Chuẩn hóa tên merchant (map NETFLIX.COM → Netflix, APPLE BILLING → Apple Services).
- [ ] 3.2.4 Xử lý ngày thiếu năm: suy luận năm dựa trên ngày hệ thống hiện tại (TC-10).

### Task 3.3 — Use Case `parseReceipt()` `M`

- [ ] 3.3.1 Nhánh Confidence Score ≥ 0.85: ghi thẳng vào `subscriptions`.

- [ ] 3.3.2 Nhánh Confidence Score < 0.85: ghi `parsing_logs` (LOW_CONFIDENCE) + gửi tin nhắn xác nhận thủ công.
- [ ] 3.3.3 Sanitize nội dung thô trước khi đưa vào prompt (chống prompt injection — Epic 12).

### Task 3.4 — Fallback Khi OpenAI Lỗi 🔴 `S`

- [ ] 3.4.1 Bọc `try/catch` quanh lời gọi OpenAI (theo [disaster-recovery-fallback.md](disaster-recovery-fallback.md) §1.2).

- [ ] 3.4.2 Lưu raw content vào `parsing_logs` với `status = FAILED`.
- [ ] 3.4.3 Gửi tin nhắn thân thiện kèm link nhập tay Google Sheets.
- [ ] 3.4.4 Cron retry ban đêm cho các bản ghi `FAILED`.

### Task 3.5 — Unit Test `M`

- [ ] 3.5.1 TC-06: Confidence ≥ 0.85 → tự động lưu.

- [ ] 3.5.2 TC-07: Confidence < 0.85 → yêu cầu xác nhận.
- [ ] 3.5.3 TC-09: Hóa đơn 0đ (Free Trial) → `amount = 0`, status = TRIAL.
- [ ] 3.5.4 TC-10: Ngày thiếu năm → suy luận đúng theo thời điểm hệ thống.

**✅ DoD Epic 3:** 100% test case Parser trong [test-cases-specification.md](test-cases-specification.md) §2-4 pass; coverage ≥ 85% cho `features/parser`.

---

## Epic 4 — Feature: Subscription State Machine 🔴

### Task 4.1 — Domain Entity & Enum `S`

- [ ] 4.1.1 Entity `Subscription` với state enum `TRIAL|ACTIVE|PENDING_KILL|KILLED`.

### Task 4.2 — Use Case `transitionState(action)` `M`

- [ ] 4.2.1 `TRIAL` + Keep → `ACTIVE` (BR-04).

- [ ] 4.2.2 `TRIAL`/`ACTIVE` + Kill → `PENDING_KILL` (kèm sinh `direct_kill_link`).
- [ ] 4.2.3 `PENDING_KILL` + xác nhận đã hủy → `KILLED`.

### Task 4.3 — Use Case `handleIncomingInvoice()` `M`

- [ ] 4.3.1 Nếu subscription đang `KILLED` và có hóa đơn mới cùng merchant+subscriber → reopen về `ACTIVE`/`TRIAL` (theo cập nhật mới nhất trong [sdd.md](sdd.md) §1.1, TC-05).

- [ ] 4.3.2 Nếu là hóa đơn dùng thử mới → set `TRIAL`; nếu là hóa đơn trả phí → set `ACTIVE`.

### Task 4.4 — Use Case `detectRedundancy()` 🟡 `M`

- [ ] 4.4.1 Query D1 tìm các merchant trùng tên đang `ACTIVE` do subscriber khác nhau đứng tên (TC-11).

- [ ] 4.4.2 Sinh gợi ý tiết kiệm (ước tính chênh lệch giá Individual vs Family plan).
- [ ] 4.4.3 Gửi thông báo gợi ý gộp gói vào nhóm chat chung.

### Task 4.5 — Repository Layer `S`

- [ ] 4.5.1 CRUD `subscriptions` qua Drizzle (create/update/find by status/find by next_billing_date range).

### Task 4.6 — Unit Test `M`

- [ ] 4.6.1 TC-01 → TC-05 (chuyển trạng thái đầy đủ, bao gồm reopen KILLED→ACTIVE).

- [ ] 4.6.2 TC-11 (redundancy detection).

**✅ DoD Epic 4:** Máy trạng thái khớp 100% với sơ đồ trong [sdd.md](sdd.md) §1 (đã cập nhật); coverage ≥ 85%.

---

## Epic 5 — Feature: Cảnh Báo Đa Tầng (Tiered Alerts) 🔴

### Task 5.1 — Domain & Cron Handler `M`

- [ ] 5.1.1 Entity `Alert` (SOFT_T3, RED_T24).

- [ ] 5.1.2 Cron `scheduled()` chạy 01:00 UTC (08:00 VN) quét `subscriptions` trạng thái `TRIAL`/`ACTIVE` — [model-flowchart.md](model-flowchart.md) §2.

### Task 5.2 — Logic Tính Mốc Thời Gian `M`

- [ ] 5.2.1 Tính số ngày còn lại = `next_billing_date - hôm nay`.

- [ ] 5.2.2 Nếu còn đúng 3 ngày → tạo `SOFT_T3`, gửi private chat kèm nút Keep/Kill (BR-04).
- [ ] 5.2.3 Nếu còn đúng 1 ngày (T-24h) và chưa phản hồi Soft Alert → kiểm tra `is_must_keep`.

### Task 5.3 — Must-Keep Exemption `S`

- [ ] 5.3.1 Nếu `is_must_keep = true` → bỏ qua Red Alert, chỉ log vào Spend Report (BR-05, TC-08).

### Task 5.4 — Red Alert Escalation `M`

- [ ] 5.4.1 Gửi tin nhắn vào nhóm chat gia đình, tag Subscriber + Card Owner.

- [ ] 5.4.2 Nội dung theo mẫu chuẩn trong [business-rules.md](business-rules.md) BR-04.

### Task 5.5 — Xử Lý Phản Hồi Người Dùng `M`

- [ ] 5.5.1 Webhook nhận postback Keep/Kill → cập nhật `alerts.response` + gọi `transitionState()`.

### Task 5.6 — Unit/Integration Test `M`

- [ ] 5.6.1 Test cron end-to-end bằng Miniflare + fake timers.

- [ ] 5.6.2 TC-08 (Must-Keep không bao giờ nhận Red Alert).

**✅ DoD Epic 5:** Toàn bộ luồng cảnh báo mô tả trong [model-sequence.md](model-sequence.md) §2 chạy đúng trong môi trường giả lập.

---

## Epic 6 — Tích Hợp Zalo OA 🔴

### Task 6.1 — Webhook Endpoint `M`

- [ ] 6.1.1 `POST /webhook/zalo`, trả `200 OK` ngay lập tức, xử lý ngầm bằng `ctx.waitUntil()` (theo [disaster-recovery-fallback.md](disaster-recovery-fallback.md) §2.1).

### Task 6.2 — Xác Thực Chữ Ký 🔴 `S`

- [ ] 6.2.1 Verify header `X-ZEvent-Signature` bằng HMAC-SHA256 + `ZALO_APP_SECRET`, constant-time compare (xem [sdd.md](sdd.md) §4.1).

- [ ] 6.2.2 Từ chối (401) nếu chữ ký sai/thiếu — viết test giả lập request giả mạo.

### Task 6.3 — Xử Lý Sự Kiện `M`

- [ ] 6.3.1 `user_send_text` → gửi sang Parser.

- [ ] 6.3.2 `user_send_image` → tải URL ảnh, gửi sang Parser (OCR qua GPT-4o-mini).
- [ ] 6.3.3 Postback Keep/Kill → gọi Epic 5 Task 5.5.

### Task 6.4 — Gửi Tin Nhắn Chủ Động (Send API) `S`

- [ ] 6.4.1 Client gửi tin nhắn riêng tư (Soft Alert) kèm quick-reply buttons.

- [ ] 6.4.2 Client gửi tin nhắn nhóm (Red Alert) kèm tag member.

### Task 6.5 — Test Payload `S`

- [ ] 6.5.1 Test theo mock payload ở [test-cases-specification.md](test-cases-specification.md) §2.1.

**✅ DoD Epic 6:** Gửi thử ảnh biên lai thật qua Zalo OA sandbox → ghi nhận đúng vào D1 + phản hồi đúng kịch bản.

---

## Epic 7 — Tích Hợp Facebook Messenger 🟡

### Task 7.1 — Webhook Verify & Endpoint `S`

- [ ] 7.1.1 `GET /webhook/messenger` xử lý challenge verification.

- [ ] 7.1.2 `POST /webhook/messenger` xử lý ngầm bằng `ctx.waitUntil()`.

### Task 7.2 — Xác Thực Chữ Ký 🔴 `S`

- [ ] 7.2.1 Verify header `X-Hub-Signature-256` bằng `MESSENGER_APP_SECRET` (xem [sdd.md](sdd.md) §4.2).

### Task 7.3 — Xử Lý Message/Postback `M`

- [ ] 7.3.1 Nhận text/attachment ảnh → gửi Parser.

- [ ] 7.3.2 Nhận postback Keep/Kill → gọi Epic 5 Task 5.5.

### Task 7.4 — Test Payload `S`

- [ ] 7.4.1 Test theo mock payload ở [test-cases-specification.md](test-cases-specification.md) §2.2.

**✅ DoD Epic 7:** Luồng Messenger tương đương Zalo, test pass đầy đủ.

---

## Epic 8 — Tích Hợp Cloudflare Email Routing 🔴

### Task 8.1 — Cấu Hình Route Rule `S`

- [ ] 8.1.1 Cấu hình Cloudflare Email Routing trỏ `subs@yourfamily.com` → Worker.

- [ ] 8.1.2 Giới hạn route chỉ nhận đúng địa chỉ đích, chống lạm dụng làm relay (xem [sdd.md](sdd.md) §4.3).

### Task 8.2 — Xử Lý Payload Email `M`

- [ ] 8.2.1 Parse `from/to/subject/text/html`.

- [ ] 8.2.2 Gửi nội dung sang Parser (Epic 3).

### Task 8.3 — Test `S`

- [ ] 8.3.1 Test theo mock payload ở [test-cases-specification.md](test-cases-specification.md) §2.3.

**✅ DoD Epic 8:** Email forward thật từ Gmail cá nhân → ghi nhận đúng subscription trong D1.

---

## Epic 9 — Đồng Bộ Google Sheets (2-way Sync) 🟡

### Task 9.1 — Google Sheets API Client `M`

- [ ] 9.1.1 Thiết lập Service Account / OAuth, lưu `GOOGLE_SHEETS_API_KEY`.

- [ ] 9.1.2 Viết wrapper gọi Sheets API (append row, read range, update row).

### Task 9.2 — Sync Chiều Đi (D1 → Sheets) `M`

- [ ] 9.2.1 Sau mỗi thay đổi `subscriptions`, đẩy dòng tương ứng lên Sheets ngay lập tức.

### Task 9.3 — Sync Chiều Về (Sheets → D1) `M`

- [ ] 9.3.1 Cron hằng ngày quét Sheets, so khớp thay đổi thủ công (ngày gia hạn, số tiền...).

- [ ] 9.3.2 Cập nhật lại D1 theo thay đổi phát hiện được.

### Task 9.4 — Test `S`

- [ ] 9.4.1 Test round-trip: sửa tay trên Sheets → chạy cron → xác nhận D1 cập nhật đúng.

**✅ DoD Epic 9:** Đồng bộ 2 chiều hoạt động ổn định, không mất dữ liệu khi có xung đột đơn giản.

---

## Epic 10 — Admin & Ops Endpoint 🟡

### Task 10.1 — Endpoint Reconcile-Sync `M`

- [ ] 10.1.1 `POST /api/admin/reconcile-sync`, bắt buộc header `Authorization: Bearer <ADMIN_API_TOKEN>` (xem [disaster-recovery-fallback.md](disaster-recovery-fallback.md) §3.1, [sdd.md](sdd.md) §4.4).

- [ ] 10.1.2 Từ chối 401 nếu thiếu/sai token, viết test cụ thể.

### Task 10.2 — Logic Hòa Giải `M`

- [ ] 10.2.1 Tải dữ liệu Sheets (nguồn chân lý) + D1, so khớp và ghi đè bản ghi sai lệch.

- [ ] 10.2.2 Gửi thông báo xác nhận hoàn tất vào nhóm chat gia đình.

### Task 10.3 — Audit Log 🟢 `S`

- [ ] 10.3.1 Ghi log ai/khi nào gọi endpoint admin (phục vụ truy vết).

**✅ DoD Epic 10:** Endpoint chạy đúng, có auth, có log, không thể gọi được nếu thiếu token.

---

## Epic 11 — Frontend: React SPA (Zalo Mini App / Messenger Webview) 🟡

### Task 11.1 — Khởi Tạo Dự Án Frontend `S`

- [ ] 11.1.1 Vite + React 18 + TypeScript + Tailwind CSS trong `apps/frontend`.

- [ ] 11.1.2 Cấu hình deploy Cloudflare Pages (`pages deploy dist`).

### Task 11.2 — Trang Dashboard Chính `L`

- [ ] 11.2.1 Danh sách subscription (merchant, amount, next billing date, status).

- [ ] 11.2.2 Biểu đồ tròn phân phối chi tiêu theo merchant/subscriber.
- [ ] 11.2.3 Đồng hồ đếm ngược `Next Billing Date`.

### Task 11.3 — Trang Quản Lý Thẻ & Cấu Hình `M`

- [ ] 11.3.1 Gán Card Owner cho subscription.

- [ ] 11.3.2 Sửa nhanh amount / next_billing_date / is_must_keep.

### Task 11.4 — Tích Hợp Zalo Mini App SDK `M`

- [ ] 11.4.1 Lấy `User ID` tự động, không yêu cầu đăng nhập lại.

### Task 11.5 — Tích Hợp Messenger Webview `M`

- [ ] 11.5.1 Nhúng SPA trong Messenger Extensions, lấy PSID tự động.

### Task 11.6 — Kết Nối API Backend `M`

- [ ] 11.6.1 Gọi API Worker (fetch/React Query), xử lý loading/error state.

### Task 11.7 — Test Cơ Bản 🟢 `S`

- [ ] 11.7.1 Smoke test render Dashboard, test tương tác nút Keep/Kill.

**✅ DoD Epic 11:** Thành viên gia đình mở Zalo Mini App / Messenger Webview thấy đúng dữ liệu, thao tác được Keep/Kill/sửa thẻ.

---

## Epic 12 — Bảo Mật & Tuân Thủ 🔴

### Task 12.1 — Rà Soát Dữ Liệu Thẻ (BR-09) `S`

- [ ] 12.1.1 Kiểm tra code không có chỗ nào lưu PAN/CVV/expiry đầy đủ.

### Task 12.2 — Rate Limiting Webhook `M`

- [ ] 12.2.1 Áp dụng rate limit cơ bản (Cloudflare Rate Limiting rules) cho `/webhook/*` và `/api/admin/*`.

### Task 12.3 — Chống Prompt Injection `M`

- [ ] 12.3.1 Sanitize nội dung email/SMS thô trước khi nhúng vào prompt gửi OpenAI (loại bỏ chỉ thị lạ, giới hạn độ dài).

### Task 12.4 — Review Secrets Management `S`

- [ ] 12.4.1 Xác nhận không có secret nào bị hardcode/commit vào git (`git log -p` scan, `.gitignore` kiểm tra `.env`).

**✅ DoD Epic 12:** Checklist bảo mật trong [sdd.md](sdd.md) §4 và [business-rules.md](business-rules.md) BR-09 được xác nhận 100% qua code review.

---

## Epic 13 — Testing & Quality Gates 🔴 (song song mọi Epic)

### Task 13.1 — Cấu Hình Vitest + Miniflare `S`

- [ ] 13.1.1 `vitest.config.ts` với coverage threshold `lines:85 / functions:90 / branches:80` (theo [test-cases-specification.md](test-cases-specification.md) §1).

### Task 13.2 — Bao Phủ Toàn Bộ Test Case `L`

- [ ] 13.2.1 TC-01 → TC-11 đầy đủ, pass 100%.

- [ ] 13.2.2 Bổ sung test case mới phát sinh trong quá trình code (mọi hàm mới đều có test đi kèm — Function-Level Test Policy).

### Task 13.3 — Pipeline Chất Lượng `S`

- [ ] 13.3.1 Xác nhận Husky pre-commit chặn đúng khi vi phạm.

- [ ] 13.3.2 Xác nhận GitHub Actions chạy đủ bước: install → format check → lint → jscpd → knip → test → deploy.

**✅ DoD Epic 13:** Coverage đạt ngưỡng quy định, CI xanh trên `main`.

---

## Epic 14 — Disaster Recovery & Backup 🟡

### Task 14.1 — Backup Định Kỳ `S`

- [ ] 14.1.1 Script/cron nhắc nhở chạy `wrangler d1 export` hàng tháng (theo [disaster-recovery-fallback.md](disaster-recovery-fallback.md) §4.1).

- [ ] 14.1.2 Lưu file `.sql` vào Google Drive cá nhân.

### Task 14.2 — Runbook Restore `S`

- [ ] 14.2.1 Diễn tập restore thử 1 lần trên môi trường staging (DROP TABLE → migrate → import) để xác nhận runbook đúng.

### Task 14.3 — Diễn Tập Outage OpenAI `S`

- [ ] 14.3.1 Giả lập OpenAI trả lỗi 500 → xác nhận fallback lưu `FAILED` + gửi link nhập tay hoạt động đúng (Epic 3 Task 3.4).

**✅ DoD Epic 14:** Đã diễn tập backup + restore + outage fallback ít nhất 1 lần thành công trước Go-Live.

---

## Epic 15 — Family Onboarding & Go-Live 🔴

### Task 15.1 — Chuẩn Bị Onboarding `S`

- [ ] 15.1.1 Gửi hướng dẫn [family-onboarding-guide.md](family-onboarding-guide.md) cho từng thành viên.

- [ ] 15.1.2 Hỗ trợ từng người cấu hình Gmail auto-forward + filter từ khóa.

### Task 15.2 — Thêm Thành Viên Vào Bot `S`

- [ ] 15.2.1 Thêm bạn bè Zalo OA / nhắn Messenger Page cho toàn bộ 10 thành viên.

- [ ] 15.2.2 Test gửi thử 1 ảnh biên lai + 1 SMS mẫu từ mỗi thành viên.

### Task 15.3 — Dry-Run Nội Bộ (1 tuần) `M`

- [ ] 15.3.1 Theo dõi sát parsing_logs, alerts trong tuần đầu.

- [ ] 15.3.2 Thu thập phản hồi, tinh chỉnh ngưỡng Confidence Score nếu cần.

### Task 15.4 — Go-Live Chính Thức `S`

- [ ] 15.4.1 Deploy production chính thức qua CI/CD.

- [ ] 15.4.2 Thông báo chính thức trong nhóm chat gia đình.

**✅ DoD Epic 15:** Toàn bộ gia đình đã onboard, hệ thống chạy ổn định qua ít nhất 1 chu kỳ cảnh báo thật (T-3 → T-24h) không lỗi.

---

## Epic 16 — Vận Hành & Cải Tiến Liên Tục 🟢 (Sau Go-Live)

### Task 16.1 — Theo Dõi KPI `S`

- [ ] 16.1.1 Theo dõi Spend Report hàng tháng, đo % tiết kiệm theo công thức trong [prd.md](prd.md) (mục tiêu ≥ 30%).

### Task 16.2 — Tinh Chỉnh Hệ Thống `M`

- [ ] 16.2.1 Điều chỉnh ngưỡng Confidence Score nếu tỷ lệ false positive/negative cao.

- [ ] 16.2.2 Bổ sung merchant mapping mới khi phát sinh dịch vụ lạ.

### Task 16.3 — Rà Soát Free Tier `S`

- [ ] 16.3.1 Kiểm tra lại hạn mức Cloudflare Free Tier hiện hành so với mức dùng thực tế (theo cảnh báo trong [problem-definition.md](problem-definition.md) §8).

### Task 16.4 — Roadmap Mở Rộng 🟢 `S`

- [ ] 16.4.1 Đánh giá nhu cầu tích hợp Notion API thay thế Google Sheets (nếu Sheets không còn đáp ứng đủ).

**✅ DoD Epic 16:** Có báo cáo vận hành hàng tháng, backlog cải tiến được ghi nhận liên tục.

---

## 2. Gợi Ý Thứ Tự Triển Khai Thực Tế (Sprint Suggestion)

| Sprint   | Nội dung                                                  |
| -------- | --------------------------------------------------------- |
| Sprint 1 | Epic 0 + Epic 1 + Epic 2                                  |
| Sprint 2 | Epic 3 + Epic 4 (song song với Epic 13 testing)           |
| Sprint 3 | Epic 5 + Epic 6 + Epic 8 (kênh input chính: Zalo + Email) |
| Sprint 4 | Epic 7 + Epic 9 + Epic 10                                 |
| Sprint 5 | Epic 11 (Frontend SPA) + Epic 12 (Security hardening)     |
| Sprint 6 | Epic 14 (DR drill) + Epic 15 (Onboarding + Go-Live)       |
| Liên tục | Epic 16                                                   |

> 💡 **Lưu ý triển khai:** Epic 12 (Bảo mật) không phải làm cuối cùng — chữ ký webhook (Task 6.2, 7.2) và auth admin (Task 10.1) phải hoàn thành **trước khi** mở endpoint ra internet thật, tức là ngay trong Sprint 3-4, không đợi tới Sprint 5.
