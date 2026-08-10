### 🛠️ SUBSENTRY — SETUP & OPERATIONS GUIDE (QoL EDITION)

**Hướng Dẫn Cấu Hình, Thiết Lập Môi Trường & Vận Hành** | _Zero-Ops Family Cooperative Defense_

**Document Version:** 1.4 | **Status:** Approved | **Last Updated:** 2026-08-10

Tài liệu này cung cấp hướng dẫn từng bước (Step-by-Step) để triển khai, cài đặt môi trường phát triển cục bộ (Local Development) và thiết lập hệ thống tự động hóa vận hành trên Cloudflare cho dự án **Subsentry (Quality of Life)**.

---

#### 1. Yêu Cầu Hệ Thống (Prerequisites)

Trước khi bắt đầu, hãy đảm bảo máy tính cá nhân của bạn đã cài đặt các công cụ sau:

- **Node.js**: Phiên bản LTS mới nhất (v20.x hoặc v22.x).
- **Yarn**: Phiên bản `v1.22.x` (Classic) hoặc `v4.x` (Berry). Trong hướng dẫn này, chúng ta sử dụng **Yarn Classic/Modern** quản lý Workspaces.
- **Wrangler CLI**: Trình quản lý Cloudflare Developer Platform (Cài đặt toàn cục qua `npm install -g wrangler` hoặc chạy trực tiếp bằng `yarn wrangler`).
- **Git**: Trình quản lý mã nguồn.

---

#### 2. Khởi Tạo Dự Án & Thiết Lập Yarn Workspaces

Dự án được tổ chức theo mô hình **Monorepo** để quản lý cả Backend (Cloudflare Workers) và Frontend (React SPA) trong cùng một kho chứa.

##### 2.1 Cấu trúc Thư mục Gốc

Tạo một thư mục mới cho dự án và khởi tạo cấu trúc:

```bash
mkdir subsentry-monorepo && cd subsentry-monorepo
mkdir -p apps/backend apps/frontend .husky
```

##### 2.2 Tạo tệp `package.json` ở Thư mục Gốc

Tạo tệp `/package.json` để quản lý các Workspace và bộ công cụ quét chất lượng mã nguồn:

```json
{
  "name": "subsentry-monorepo",
  "private": true,
  "version": "1.0.0",
  "workspaces": ["apps/backend", "apps/frontend"],
  "scripts": {
    "backend:dev": "yarn workspace @subsentry/backend dev",
    "backend:deploy": "yarn workspace @subsentry/backend deploy",
    "frontend:dev": "yarn workspace @subsentry/frontend dev",
    "frontend:build": "yarn workspace @subsentry/frontend build",
    "frontend:deploy": "yarn workspace @subsentry/frontend deploy",
    "prepare": "husky",
    "lint": "eslint \"apps/**/*.{ts,tsx,js,jsx}\"",
    "lint:fix": "eslint \"apps/**/*.{ts,tsx,js,jsx}\" --fix",
    "format": "prettier --write \"apps/**/*.{ts,tsx,js,jsx,json,md}\"",
    "duplicate:check": "jscpd apps/",
    "deadcode:check": "knip",
    "test": "vitest run"
  },
  "devDependencies": {
    "eslint": "^9.0.0",
    "husky": "^9.0.11",
    "jscpd": "^3.5.25",
    "knip": "^3.0.0",
    "prettier": "^3.2.5",
    "vitest": "^2.0.0"
  }
}
```

Chạy lệnh cài đặt các dependencies ban đầu:

```bash
yarn install
```

---

#### 3. Cấu Hình Git Hooks Với Husky & Pre-commit Gates

Để đảm bảo kỷ luật mã nguồn nghiêm ngặt, tự động chặn việc đưa code bẩn hoặc code trùng lặp lên hệ thống, chúng ta sẽ cấu hình kiểm duyệt pre-commit.

##### 3.1 Kích Hoạt Husky

Khởi tạo Husky trong thư mục dự án:

```bash
npx husky init
```

##### 3.2 Cấu Hình File Hook `.husky/pre-commit`

Ghi đè nội dung tệp `.husky/pre-commit` để tự động thực thi chuỗi kiểm định an toàn chất lượng:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "=== 🛡️ RUNNING PRE-COMMIT QUALITY GATES ==="

# 1. Định dạng code tự động
echo "🎨 Step 1: Formatting code with Prettier..."
yarn format || { echo "❌ Prettier failed! Pre-commit aborted."; exit 1; }

# 2. Quét lỗi cú pháp và cảnh báo code sạch
echo "🔍 Step 2: Linting with ESLint..."
yarn lint || { echo "❌ ESLint failed! Pre-commit aborted."; exit 1; }

# 3. Kiểm tra mã nguồn sao chép trùng lặp (jscpd)
echo "👥 Step 3: Checking code duplication with jscpd..."
yarn duplicate:check || { echo "❌ High code duplication (> 5%) detected! Pre-commit aborted."; exit 1; }

# 4. Quét tệp dư thừa, xuất khẩu thừa (Knip)
echo "🧹 Step 4: Scanning for dead code & unused imports with Knip..."
yarn deadcode:check || { echo "❌ Unused files or exports detected! Pre-commit aborted."; exit 1; }

# 5. Khởi chạy toàn bộ hệ thống Unit Test của Vitest
echo "🧪 Step 5: Running Vitest Suite..."
yarn test || { echo "❌ Unit Tests failed! Pre-commit aborted."; exit 1; }

echo "✅ ALL QUALITY GATES PASSED! Committing code..."
```

Cấp quyền thực thi cho tệp hook:

```bash
chmod +x .husky/pre-commit
```

---

#### 4. Cấu Hình Backend (Cloudflare Workers & Drizzle ORM)

##### 4.1 Tạo Tệp `wrangler.toml` cho Backend

Di chuyển vào `apps/backend` và tạo tệp cấu hình `wrangler.toml` để liên kết các tài nguyên Serverless:

```toml
name = "subsentry-backend"
main = "src/index.ts"
compatibility_date = "2026-08-01"

[vars]
ENVIRONMENT = "production"

[[d1_databases]]
binding = "DB" # Ràng buộc gọi trong code: env.DB
database_name = "subsentry-db"
database_id = "YOUR_D1_DATABASE_ID" # Điền ID nhận được khi tạo DB từ Cloudflare Dash

[triggers]
crons = [ "0 1 * * *" ] # Cloudflare Cron Triggers luôn chạy theo giờ UTC. 01:00 UTC = 08:00 sáng giờ Việt Nam (UTC+7)
```

##### 4.2 Lệnh Khởi Tạo và Quản Lý Drizzle Migrations

Để cấu hình schema cơ sở dữ liệu và thực hiện đồng bộ (migration) lên Cloudflare D1:

1.  **Sinh tệp Migration mới từ Drizzle Schema**:

    ```bash
    yarn workspace @subsentry/backend drizzle-kit generate
    ```

    _Hành động này sẽ đọc các định nghĩa bảng trong code của bạn và sinh ra các file SQL tương ứng trong thư mục `apps/backend/drizzle/`._

2.  **Áp dụng Migration vào môi trường Local (để chạy thử)**:

    ```bash
    yarn workspace @subsentry/backend wrangler d1 migrations apply subsentry-db --local
    ```

3.  **Áp dụng Migration lên Cloudflare D1 Production (môi trường đám mây thực tế)**:
    ```bash
    yarn workspace @subsentry/backend wrangler d1 migrations apply subsentry-db --remote
    ```

---

#### 5. Cấu Hình Bảo Mật (Secrets & API Keys)

Không bao giờ được lưu các khóa API, token bí mật trực tiếp trong mã nguồn. Hãy sử dụng cơ chế bảo mật của Cloudflare Workers:

##### 5.1 Các Khóa Bảo Mật Cần Thiết

- `OPENAI_API_KEY`: Khóa API của OpenAI sử dụng mô hình GPT-4o-mini.
- `TELEGRAM_BOT_TOKEN`: Token dùng để gọi Telegram Bot API gửi tin nhắn chủ động và nhận cập nhật.
- `TELEGRAM_WEBHOOK_SECRET`: Chuỗi bí mật thiết lập khi gọi `setWebhook`, dùng để xác thực header `X-Telegram-Bot-Api-Secret-Token` của mọi webhook Telegram gửi tới.
- `TELEGRAM_FAMILY_GROUP_CHAT_ID`: Chat ID của nhóm Telegram gia đình, dùng để gửi Red Alert trực tiếp vào nhóm kèm tag Subscriber + Card Owner.
- `GOOGLE_SHEET_ID`: ID của file Google Sheets để đồng bộ.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Email của Google Service Account có quyền edit file Sheets.
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`: Private key của Service Account (định dạng RSA).
- `ADMIN_API_TOKEN`: Token bảo vệ các endpoint quản trị nội bộ (ví dụ `/api/admin/reconcile-sync`).

##### 5.2 Cách cấu hình trên Cloudflare Edge thông qua Wrangler CLI

Chạy các dòng lệnh sau trên Terminal để thiết lập bảo mật:

```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_WEBHOOK_SECRET
wrangler secret put TELEGRAM_FAMILY_GROUP_CHAT_ID
wrangler secret put GOOGLE_SHEET_ID
wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
wrangler secret put GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
wrangler secret put ADMIN_API_TOKEN
```

_Hệ thống sẽ nhắc bạn nhập giá trị bí mật cho từng khóa. Các biến này sẽ tự động được truyền vào đối tượng `env` của Cloudflare Worker khi chạy thực tế._

---

#### 6. Quy Trình CI/CD Tự Động Hóa Qua GitHub Actions

Tạo tệp cấu hình quy trình CI/CD tự động tại địa chỉ `.github/workflows/deploy.yml`:

```yaml
name: Subsentry Zero-Ops CI/CD Pipeline

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

jobs:
  validate-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: 📥 Checkout repository
        uses: actions/checkout@v4

      - name: 🟢 Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'yarn'

      - name: 📦 Install dependencies
        run: yarn install --frozen-lockfile

      - name: 🎨 Verify Formatting
        run: yarn format --check

      - name: 🔍 Verify Syntax (Linting)
        run: yarn lint

      - name: 👥 Check Code Duplication (jscpd)
        run: yarn duplicate:check

      - name: 🧹 Check Dead Code (Knip)
        run: yarn deadcode:check

      - name: 🧪 Run Vitest Suites
        run: yarn test

      - name: 🚀 Deploy Backend to Cloudflare Workers (Only on Main)
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: 'apps/backend'

      - name: 🚀 Deploy Frontend to Cloudflare Pages (Only on Main)
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: 'apps/frontend'
          command: pages deploy dist --project-name=subsentry-frontend
```

---

#### 7. Đăng Ký Webhook Telegram (`setWebhook`)

Sau khi deploy Worker và tạo bot qua **@BotFather** (lệnh `/newbot` để lấy `TELEGRAM_BOT_TOKEN`), cần đăng ký một lần webhook trỏ Telegram Server về đúng route `/webhook/telegram`. Dùng script có sẵn tại [apps/backend/scripts/set-telegram-webhook.sh](../apps/backend/scripts/set-telegram-webhook.sh):

```bash
TELEGRAM_BOT_TOKEN=xxx \
TELEGRAM_WEBHOOK_SECRET=yyy \
WORKER_URL=https://subsentry-backend.<subdomain>.workers.dev \
  ./apps/backend/scripts/set-telegram-webhook.sh
```

Hoặc gọi trực tiếp bằng `curl` tương đương:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://<worker-domain>/webhook/telegram", "secret_token": "<TELEGRAM_WEBHOOK_SECRET>"}'
```

Kiểm tra lại trạng thái đăng ký bất kỳ lúc nào bằng:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

Cuối cùng, thêm bot vào **Nhóm Chat Gia Đình** trên Telegram và lấy `chat_id` của nhóm (ví dụ qua `getUpdates` hoặc bot `@userinfobot`) để cấu hình secret `TELEGRAM_FAMILY_GROUP_CHAT_ID` — giá trị này được `TelegramNotificationAdapter.sendRedAlert()` dùng để gửi Red Alert trực tiếp vào nhóm kèm tag Subscriber + Card Owner.

---

#### 8. Cấu Hình Cloudflare Email Routing (Tích Hợp Forward Email)

Để hệ thống nhận email chuyển tiếp tự động từ Gmail cá nhân của các thành viên gia đình:

1. **Kích hoạt Cloudflare Email Routing**:
   - Vào Cloudflare Dashboard → chọn Domain gia đình (ví dụ: `yourfamily.com`).
   - Vào mục **Email** → **Email Routing**.
   - Bật tính năng Email Routing và làm theo hướng dẫn thiết lập bản ghi DNS (MX & TXT) tự động.

2. **Thêm Custom Address Rule**:
   - Chọn tab **Routing rules** → bấm **Create rule**.
   - **Custom address**: Điền `subs` (tạo địa chỉ email `subs@yourfamily.com`).
   - **Action**: Chọn **Send to a Worker**.
   - **Destination Worker**: Chọn `subsentry-backend`.
   - Bấm **Save**.

3. **Cấu hình Secret `ALLOWED_EMAIL_TO` (Tùy chọn)**:
   - Nếu sử dụng địa chỉ email đích khác mặc định (`subs@yourfamily.com`), thiết lập biến bí mật cho Worker:
     ```bash
     wrangler secret put ALLOWED_EMAIL_TO
     # Nhập địa chỉ: subs@domain_cua_ban.com
     ```

---

#### 9. Tích Hợp Google Apps Script (Cho Gia Đình Không Có Tên Miền Riêng — 0đ)

Nếu gia đình **chỉ sử dụng `@gmail.com`** và không sở hữu tên miền riêng:

1. **Thiết lập secret trên Worker**:

   ```bash
   wrangler secret put GMAIL_WEBHOOK_SECRET
   # Nhập một chuỗi ngẫu nhiên bí mật (ví dụ: my-family-secret-key-123)
   ```

2. **Cài đặt Google Apps Script trên Gmail cá nhân**:
   - Mở [https://script.google.com/](https://script.google.com/) ➡️ Bấm **Dự án mới** (New project).
   - Copy nội dung file script từ dự án: [`apps/backend/scripts/gmail-apps-script.js`](../apps/backend/scripts/gmail-apps-script.js) và dán vào trình biên dịch.
   - Chỉnh sửa 2 dòng cấu hình:
     ```javascript
     const WORKER_URL = 'https://subsentry-backend.<subdomain>.workers.dev/webhook/email';
     const SECRET_TOKEN = 'my-family-secret-key-123';
     ```
   - Bấm **Lưu** (💾).
   - Chọn hàm `setupTrigger` ở menu thả xuống ➡️ Bấm **Chạy** (Run) ➡️ Chấp nhận cấp quyền cho Gmail khi Google hỏi.

3. **Hoàn tất**: Script sẽ chạy ngầm định kỳ 10 phút/lần, tự động quét các email chứa từ khóa hóa đơn/dùng thử và đẩy về Worker HTTP endpoint `POST /webhook/email`.
