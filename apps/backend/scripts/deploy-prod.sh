#!/bin/bash
set -e

# Chuyển đến thư mục backend
cd /Users/thinhquoc/Desktop/Persional/Enterprise/subsentry/apps/backend

# 1. Chạy Migrations trên Remote D1
echo "🚀 Áp dụng Migrations lên D1 Production..."
yarn wrangler d1 migrations apply subsentry-db --remote

# 2. Upload Secrets từ .dev.vars
echo "🔑 Tải lên các bí mật (Secrets) từ .dev.vars..."
while IFS='=' read -r key value; do
  if [[ -z "$key" || "$key" == \#* ]]; then continue; fi
  # Xoá quote nếu có
  value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//')
  # Xoá "\n" literal sang kí tự xuống dòng thực tế nếu là RSA key (tránh lỗi định dạng)
  value=$(echo "$value" | sed 's/\\n/\n/g')
  echo "$value" | yarn wrangler secret put "$key"
done < .dev.vars

# 3. Đăng ký lại Webhook Telegram với URL chính xác
echo "🌐 Đăng ký Webhook Telegram..."
export WORKER_URL="https://subsentry-backend.stegamerpro123.workers.dev"
export TELEGRAM_BOT_TOKEN="8421843170:AAHxCTlaO-uww77-CAlOohaaxkPIJhGElLk"
export TELEGRAM_WEBHOOK_SECRET="85153983-d165-4938-aebb-e7c3f5e0f0cd"
bash ./scripts/set-telegram-webhook.sh

echo "✅ Hoàn tất thiết lập Production!"
