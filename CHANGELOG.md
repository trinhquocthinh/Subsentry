# Changelog

Toàn bộ thay đổi đáng chú ý của dự án **Subsentry** được ghi lại tại đây.

Định dạng dựa trên [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), dự án tuân thủ [Semantic Versioning](https://semver.org/lang/vi/).

---

## [1.0.0] — 2026-08-10 · 🚀 GA / Go-Live

Bản phát hành chính thức đầu tiên. Hoàn thành toàn bộ Epic 0 → 15 của [master-plan.md](docs/master-plan.md); hệ thống đã chạy thật cho gia đình 10 thành viên.

### Added

- **Data Layer** (Epic 1) — 5 bảng D1 (`members`, `payment_cards`, `subscriptions`, `alerts`, `parsing_logs`) với Drizzle ORM, migration qua Drizzle Kit và CHECK constraint ở tầng database cho mọi cột enum.
- **Core Architecture** (Epic 2) — Shared kernel theo Clean Architecture: Drizzle client, global error handler, request logger, enum dùng chung.
- **AI Parser** (Epic 3) — Bóc tách hóa đơn bằng `gpt-4o-mini` kèm `confidence_score`, sanitize chống prompt injection, fallback lưu `FAILED` khi OpenAI lỗi và cron tự retry.
- **Subscription State Machine** (Epic 4) — Máy trạng thái `TRIAL → ACTIVE → PENDING_KILL → KILLED` khớp đặc tả [sdd.md](docs/sdd.md) §1.
- **Tiered Alerts** (Epic 5) — Cảnh báo hai tầng: `SOFT_T3` nhắn riêng ở mốc T-3 ngày, leo thang `RED_T24` vào group chat gia đình ở mốc T-24h nếu không có phản hồi.
- **Telegram Bot** (Epic 7) — Webhook có xác thực secret token, nhận ảnh biên lai và text SMS, inline keyboard Keep/Kill, notification adapter gửi vào chat riêng và group.
- **Email Ingestion** (Epic 8) — Hai kênh: Cloudflare Email Routing (`postal-mime`) và Google Apps Script HTTP POST. Tự động gán hoặc tạo thành viên từ địa chỉ gửi.
- **Google Sheets 2-way Sync** (Epic 9) — Đồng bộ hai chiều D1 ↔ Sheets qua service account, chạy trong cron hằng ngày.
- **Admin & Ops Endpoint** (Epic 10) — `POST /api/admin/reconcile-sync` bảo vệ bằng `ADMIN_API_TOKEN`.
- **Telegram Mini App** (Epic 11) — React 18 SPA (Vite + Tailwind + TanStack Query + Recharts): dashboard chi tiêu, thao tác Keep/Kill, quản lý thẻ.
- **REST API** — `/api/v1` với 6 endpoint phục vụ Mini App, xác thực qua `X-Telegram-Init-Data`.
- **Cron Trigger** — `0 1 * * *`: xử lý cảnh báo đa tầng, retry bản ghi parse lỗi và đồng bộ Sheets song song.
- **Backup & Restore** (Epic 14) — `yarn db:backup` / `yarn db:restore` kèm [dr-runbook.md](docs/dr-runbook.md).
- **CI/CD** — GitHub Actions chạy 6 cổng chất lượng, tự deploy Workers + Pages khi push vào `main`.

### Security

- Xác thực chữ ký webhook Telegram (`X-Telegram-Bot-Api-Secret-Token`) và shared secret cho Google Apps Script (Epic 12).
- Rate limiting qua Cloudflare binding: 60 req/phút cho `/webhook/*`, 10 req/phút cho `/api/admin/*`.
- Sanitize nội dung thô trước khi đưa vào prompt AI.
- Không lưu số thẻ đầy đủ — chỉ nhãn thẻ và 4 số cuối.
- Toàn bộ credential quản lý qua `wrangler secret`, không có gì trong repo.

### Quality

- **Coverage 94.15% lines / 91.76% functions / 84.47% branches** — vượt cả 3 ngưỡng (85/90/80). Baseline đầu Epic 13 là 78.28 / 78.82 / 63.02 (fail cả 3).
- 35 test file phủ 87 file nguồn, chạy trên Vitest 4 + Miniflare.
- Cổng chất lượng ở cả pre-commit hook và CI: Prettier, ESLint 9, jscpd, Knip, coverage threshold.

### Removed

- **Zalo OA integration** (Epic 6) — gỡ bỏ hoàn toàn `features/zalo/`. Nguyên nhân là rào cản nền tảng không thể vượt qua: bắt buộc xác minh doanh nghiệp cho Official Account, không có API gửi Group Chat, và cửa sổ nhắn tin chủ động chỉ 7 ngày. Thay thế bằng Telegram Bot (Epic 7) — vốn đã được thiết kế làm kênh song song từ đầu, thể hiện qua cột `telegram_chat_id` có sẵn trong ERD.

---

## Nhật ký phiên bản tài liệu

Các tài liệu đặc tả được đánh version độc lập theo số lần chỉnh sửa thực tế trong lịch sử git.

| Tài liệu                                                            | Version | Lần cập nhật cuối      |
| ------------------------------------------------------------------- | :-----: | ---------------------- |
| [master-plan.md](docs/master-plan.md)                               |  1.15   | Epic 15 — Go-Live      |
| [sdd.md](docs/sdd.md)                                               |   1.5   | Epic 12 — Bảo mật      |
| [setup-and-ops-guide.md](docs/setup-and-ops-guide.md)               |   1.4   | Epic 9 — Sheets Sync   |
| [family-onboarding-guide.md](docs/family-onboarding-guide.md)       |   1.3   | Epic 15 — Go-Live      |
| [prd.md](docs/prd.md)                                               |   1.2   | Epic 7 — Telegram      |
| [techspec.md](docs/techspec.md)                                     |   1.2   | v1.0.0 — đồng bộ stack |
| [business-rules.md](docs/business-rules.md)                         |   1.2   | Epic 7 — Telegram      |
| [problem-definition.md](docs/problem-definition.md)                 |   1.2   | Epic 7 — Telegram      |
| [model-c4.md](docs/model-c4.md)                                     |   1.2   | Epic 7 — Telegram      |
| [model-erd.md](docs/model-erd.md)                                   |   1.2   | Epic 7 — Telegram      |
| [model-flowchart.md](docs/model-flowchart.md)                       |   1.2   | Epic 7 — Telegram      |
| [model-sequence.md](docs/model-sequence.md)                         |   1.2   | Epic 7 — Telegram      |
| [test-cases-specification.md](docs/test-cases-specification.md)     |   1.2   | Epic 7 — Telegram      |
| [disaster-recovery-fallback.md](docs/disaster-recovery-fallback.md) |   1.2   | Epic 7 — Telegram      |
| [dr-runbook.md](docs/dr-runbook.md)                                 |   1.0   | Epic 14 — DR & Backup  |

---

## Sắp tới — Epic 16 (Vận hành & cải tiến liên tục)

- Báo cáo chi tiêu hàng tháng tự động gửi vào group chat
- Nâng cấp thuật toán phát hiện gói trùng lặp
- Mở rộng bộ nhà cung cấp được nhận diện trong Google Apps Script

[1.0.0]: https://github.com/trinhquocthinh/Subsentry/releases/tag/v1.0.0
