#!/bin/sh
# Đăng ký (hoặc cập nhật) webhook Telegram trỏ về Worker đang chạy.
# Yêu cầu: đã `wrangler secret put TELEGRAM_BOT_TOKEN` và `TELEGRAM_WEBHOOK_SECRET`.
#
# Sử dụng:
#   TELEGRAM_BOT_TOKEN=xxx TELEGRAM_WEBHOOK_SECRET=yyy WORKER_URL=https://subsentry-backend.<subdomain>.workers.dev \
#     ./apps/backend/scripts/set-telegram-webhook.sh

set -eu

: "${TELEGRAM_BOT_TOKEN:?Thiếu biến TELEGRAM_BOT_TOKEN}"
: "${TELEGRAM_WEBHOOK_SECRET:?Thiếu biến TELEGRAM_WEBHOOK_SECRET}"
: "${WORKER_URL:?Thiếu biến WORKER_URL, ví dụ https://subsentry-backend.<subdomain>.workers.dev}"

curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H 'Content-Type: application/json' \
  -d "{\"url\": \"${WORKER_URL}/webhook/telegram\", \"secret_token\": \"${TELEGRAM_WEBHOOK_SECRET}\"}"

echo
echo "Kiểm tra lại trạng thái webhook:"
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
echo
