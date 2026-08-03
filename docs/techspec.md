# 🛠️ TECHNICAL SPECIFICATION & ARCHITECTURE DESIGN — Subsentry

**Kiến Trúc Hệ Thống & Đặc Tả Kỹ Thuật Dự Án** | _Enterprise-Grade Clean Architecture for Family Project_

**Document Version:** 1.0 | **Status:** Approved

| Technology Dimension         | Selected Stack & Version                              |
| ---------------------------- | ----------------------------------------------------- |
| **Monorepo Manager**         | Yarn Workspaces (v1.22.x / v4.x)                      |
| **Backend API Framework**    | Hono Framework (v4.5.x) on Cloudflare Workers         |
| **Database & ORM**           | Cloudflare D1 (SQLite) & Drizzle ORM (v0.32.x)        |
| **Frontend Framework**       | React (v18.3.x) + Vite (v5.x) + Tailwind CSS (v3.x)   |
| **Frontend Deploy Platform** | Cloudflare Pages (Serverless Single Page Application) |
| **Linter & Formatter**       | ESLint (v9.x Flat Config) & Prettier (v3.x)           |
| **Quality Gates Tools**      | Husky (v9.x), jscpd (v3.x), Knip (v3.x)               |
| **Testing Engine**           | Vitest (v2.0.x)                                       |

---

## 1. System Architecture & Component Diagram

Hệ thống Subsentry sử dụng kiến trúc **Serverless Monorepo** chạy hoàn toàn trên Cloudflare để tối ưu hóa hiệu năng, giảm độ trễ tại Việt Nam về mức tối thiểu, đồng thời duy trì chi phí vận hành ở mức $0.

```
                                  ┌──────────────────────────────────────────┐
                                  │           CLOUDFLARE PAGES               │
                                  │  (React 18, Tailwind, Zalo Mini App SDK)  │
                                  └────────────────────┬─────────────────────┘
                                                       │ (HTTPS JSON API)
                                                       ▼
┌──────────────────┐              ┌──────────────────────────────────────────┐
│ Cloudflare Email ├─────────────►│             CLOUDFLARE WORKERS           │
│  Routing Webhook │              │        (Hono API Engine, Router)         │
└──────────────────┘              └──────┬─────────────┬─────────────┬───────┘
                                         │             │             │
┌──────────────────┐                     │             │             │
│   Zalo OA & FB   │◄────────────────────┘             │             │
│ Messenger Webhook│ (Push Messaging API)              │             │
└──────────────────┘                                   ▼             ▼
                                                ┌─────────────┐┌─────────────┐
                                                │CLOUDFLARE D1││ OPENAI API  │
                                                │ (SQLite DB) ││(GPT-4o-mini)│
                                                └─────────────┘└─────────────┘
```

### 1.1 Chi Tiết Các Thành Phần Hạ Tầng (Infrastructure)

- **Cloudflare Workers (Backend):** Engine chính của hệ thống. Nhận dữ liệu webhook từ Zalo, Messenger, Email Routing và định tuyến xử lý. Vận hành theo cơ chế Serverless Edge Computing.
- **Cloudflare Pages (Frontend):** Hosting và CDN cho ứng dụng React SPA. SPA này đóng vai trò:
  1. **Zalo Mini App (ZMA):** Tích hợp sâu vào ứng dụng Zalo của thành viên để cung cấp giao diện quản lý Subscription trực tiếp mà không cần mở trình duyệt ngoài.
  2. **Messenger Webview (In-App Browser):** Khi thành viên mở link Dashboard từ Messenger Bot, giao diện SPA được render tối ưu trong trình duyệt tích hợp của Messenger.
- **Cloudflare D1 (Database):** Cơ sở dữ liệu quan hệ SQLite chạy trực tiếp trên các Node Edge, đảm bảo thời gian truy vấn dữ liệu từ Việt Nam dưới 15ms.

---

## 2. Feature-driven Clean Architecture (Thiết Kế Mã Nguồn Theo Feature)

Để tránh tình trạng phình to mã nguồn và dễ dàng bảo trì hoặc thay thế cổng giao tiếp (ví dụ: chuyển đổi/bổ sung các cổng chatbot chat), dự án áp dụng mô hình **Clean Architecture tổ chức theo Feature**.

### 2.1 Cấu Trúc Monorepo Thư Mục Dự Án

```
/subsentry-monorepo
├── .husky/                         # Husky git hooks
│   ├── pre-commit                  # Git hook chặn commit nếu vi phạm lint/test/duplicate
├── apps
│   ├── backend                     # Cloudflare Workers API (Hono Framework)
│   │   ├── src
│   │   │   ├── core                # Shared core logic, middlewares, database clients
│   │   │   │   ├── db              # Drizzle ORM client, schemas, migrations
│   │   │   │   └── errors          # Error handling base classes
│   │   │   └── features            # Clean Architecture Features
│   │   │       ├── subscription    # Feature Quản lý Subscription
│   │   │       │   ├── domain      # Entities, Interfaces, Business logic thuần túy
│   │   │       │   ├── use-cases   # Các luồng nghiệp vụ xử lý cụ thể
│   │   │       │   ├── adapters    # Controllers, Repositories, DTOs
│   │   │       │   └── index.ts    # Entrypoint cho Feature
│   │   │       ├── alert           # Feature Gửi & Leo thang cảnh báo
│   │   │       └── parser          # Feature Bóc tách hóa đơn bằng OpenAI
│   │   ├── tests                   # Vitest unit & integration tests
│   │   ├── wrangler.toml           # Cấu hình deploy Cloudflare Worker
│   │   └── package.json
│   └── frontend                    # React SPA (Zalo Mini App & Messenger Webview)
│       ├── src
│       │   ├── components          # UI Components (shadcn/ui, Tailwind CSS)
│       │   ├── hooks               # Custom React Hooks
│       │   ├── pages               # Dashboard Pages
│       │   └── main.tsx
│       ├── vite.config.ts          # Vite Configuration
│       └── package.json
├── package.json                    # Root package.json (Yarn Workspaces)
├── eslint.config.js                # ESLint v9 Flat Config
├── .prettierrc                     # Prettier config
├── jscpd.json                      # Cấu hình phát hiện code trùng lặp
└── knip.json                       # Cấu hình phát hiện code chết, dependencies rác
```

---

## 3. DevOps, Code Quality Gates & Git Hooks Setup

Dự án thiết lập một hệ thống rào chắn chất lượng nghiêm ngặt trước khi code được đẩy lên kho lưu trữ Github hoặc deploy tự động:

### 3.1 Cấu Hình Tooling

- **Yarn Workspaces:** Quản lý dependency tập trung cho cả Frontend và Backend.
- **ESLint (v9 Flat Config):** Kiểm duyệt cú pháp JS/TS, tuân thủ viết code sạch.
- **Prettier (v3):** Định dạng code tự động thống nhất trong gia đình phát triển.
- **jscpd (v3):** Copy-Paste Detector. **Chặn commit** nếu tỷ lệ trùng lặp code giữa các module vượt quá **5%**.
- **Knip (v3):** Tự động phát hiện và cảnh báo các export không sử dụng, các file không được import ở đâu (dead code) hoặc dependencies chưa dọn dẹp trong `package.json`.

### 3.2 Husky Pre-commit Hook Lifecycle (Vòng Đời Kiểm Duyệt Git Commit)

Mỗi khi lập trình viên thực hiện câu lệnh `git commit`, Husky hook sẽ tự động kích hoạt chuỗi tác vụ sau:

```
[ git commit ] ──► [ Yarn Lint ] ──► [ Prettier Check ] ──► [ jscpd Check ] ──► [ Knip Check ] ──► [ Vitest Suite ] ──► [ Commit Success ]
```

Nếu bất kỳ bước nào trong chuỗi trên bị thất bại (trả về exit code khác 0), lệnh commit sẽ bị hủy bỏ ngay lập tức và in lỗi chi tiết ra console để lập trình viên chỉnh sửa.

---

## 4. Strict Testing Specification (Quy Hoạch Kiểm Thử Nghiêm Ngặt)

Để dự án QoL hoạt động ổn định và tin cậy tuyệt đối, quy trình kiểm thử bắt buộc phải áp dụng quy tắc kiểm thử tự động khắt khe sau:

### 4.1 Quy Tắc Testing Bắt Buộc (Strict Test Coverage Rules)

1. **Chính sách Function-Level Test:** Mỗi khi lập trình viên viết thêm một hàm (function) helper hoặc core logic mới, bắt buộc phải khởi tạo hoặc bổ sung test case tương ứng trong file `.test.ts`. Hàm không có test case đi kèm sẽ bị chặn trong khâu Code Review tự động.
2. **Chính sách Feature-Level Unit Test:** Khi một Feature (ví dụ: `features/subscription`) hoàn thiện, tất cả các Use Cases trong feature đó phải được phủ tối thiểu **85% Line Coverage** bằng các Unit Test của Vitest.
3. **Môi trường Test:** Sử dụng **Vitest** kết hợp với **Miniflare** (Cloudflare Workers Simulator) để viết Unit Test và Integration Test giả lập chính xác môi trường runtime Edge của Cloudflare Workers và cơ sở dữ liệu D1.

---

## 5. Deployment & CI/CD pipeline Spec

Quy trình tích hợp và triển khai liên tục (CI/CD) được tự động hóa hoàn toàn thông qua **GitHub Actions**:

### 5.1 Các Bước Chạy Trong Github Actions

1. **Trigger:** Khi có sự kiện `push` hoặc `pull_request` hợp lệ vào nhánh `main`.
2. **Quality Gate Validation:**
   - Chạy `yarn install` để đồng bộ node_modules.
   - Chạy `yarn lint` để kiểm tra lỗi cú pháp.
   - Chạy `yarn duplicate:check` (jscpd) để kiểm tra mã nguồn trùng lặp.
   - Chạy `yarn deadcode:check` (knip) để quét code chết.
   - Chạy `yarn test` (Vitest) để chạy toàn bộ suite test kiểm thử của Backend và Frontend.
3. **Continuous Deployment (CD):**
   - Nếu tất cả các bước Quality Gate trên thành công:
     - Triển khai Backend lên Cloudflare Workers thông qua công cụ **Wrangler Deploy Action** (`wrangler deploy`).
     - Triển khai Frontend lên Cloudflare Pages thông qua **Cloudflare Pages Deploy Action**.
