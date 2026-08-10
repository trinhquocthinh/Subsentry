#!/usr/bin/env bash
# ============================================================================
# 🛡️ SUBSENTRY — D1 Database Restore Script
# Epic 14, Task 14.2 — Disaster Recovery & Backup
# Ref: docs/disaster-recovery-fallback.md §4.2
# ============================================================================
set -euo pipefail

# --- Configuration ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
DB_NAME="subsentry-db"

# --- Colors ---
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

# --- Parse Arguments ---
BACKUP_FILE=""
ENV_TARGET="local"

usage() {
  echo ""
  echo -e "${CYAN}Sử dụng:${NC}"
  echo "  ./restore-d1.sh --file <path-to-backup.sql> [--env <local|remote>]"
  echo ""
  echo "  --file    Đường dẫn file backup SQL (bắt buộc)"
  echo "  --env     Môi trường: local (mặc định) hoặc remote (production)"
  echo ""
  echo -e "${YELLOW}Ví dụ:${NC}"
  echo "  ./restore-d1.sh --file ./backups/backup-subsentry-2026-08-01.sql"
  echo "  ./restore-d1.sh --file ./backups/backup-subsentry-2026-08-01.sql --env remote"
  echo ""
  exit 1
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --file)
      BACKUP_FILE="$2"
      shift 2
      ;;
    --env)
      ENV_TARGET="$2"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo -e "${RED}❌ Tham số không hợp lệ: $1${NC}"
      usage
      ;;
  esac
done

# --- Validation ---
if [ -z "$BACKUP_FILE" ]; then
  echo -e "${RED}❌ Thiếu tham số --file. Vui lòng chỉ định file backup SQL.${NC}"
  usage
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo -e "${RED}❌ File backup không tồn tại: ${BACKUP_FILE}${NC}"
  exit 1
fi

if [[ "$ENV_TARGET" != "local" && "$ENV_TARGET" != "remote" ]]; then
  echo -e "${RED}❌ --env phải là 'local' hoặc 'remote'. Nhận: ${ENV_TARGET}${NC}"
  exit 1
fi

# Xác định flag wrangler
WRANGLER_FLAG=""
if [ "$ENV_TARGET" = "remote" ]; then
  WRANGLER_FLAG="--remote"
else
  WRANGLER_FLAG="--local"
fi

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  🛡️  Subsentry D1 Database Restore            ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  📄 File backup : ${BOLD}${BACKUP_FILE}${NC}"
echo -e "  🌐 Môi trường  : ${BOLD}${ENV_TARGET}${NC}"
echo ""

# --- Safety Confirmation ---
if [ "$ENV_TARGET" = "remote" ]; then
  echo -e "${RED}╔══════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║  ⚠️  CẢNH BÁO: ĐANG THAO TÁC TRÊN PRODUCTION  ║${NC}"
  echo -e "${RED}║                                              ║${NC}"
  echo -e "${RED}║  Hành động này sẽ XÓA TOÀN BỘ dữ liệu      ║${NC}"
  echo -e "${RED}║  hiện tại trên D1 Production và thay thế     ║${NC}"
  echo -e "${RED}║  bằng file backup đã chỉ định.               ║${NC}"
  echo -e "${RED}║                                              ║${NC}"
  echo -e "${RED}║  KHÔNG THỂ HOÀN TÁC (IRREVERSIBLE)!         ║${NC}"
  echo -e "${RED}╚══════════════════════════════════════════════╝${NC}"
  echo ""
  echo -ne "${RED}Gõ 'RESTORE-PROD' để xác nhận: ${NC}"
  read -r CONFIRM
  if [ "$CONFIRM" != "RESTORE-PROD" ]; then
    echo -e "${YELLOW}❌ Đã hủy. Không có thay đổi nào được thực hiện.${NC}"
    exit 0
  fi
else
  echo -ne "${YELLOW}⚠️  Sẽ DROP toàn bộ bảng trên D1 (${ENV_TARGET}) và restore từ backup. Tiếp tục? (y/N): ${NC}"
  read -r CONFIRM
  if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo -e "${YELLOW}❌ Đã hủy.${NC}"
    exit 0
  fi
fi

echo ""
cd "$BACKEND_DIR"

# --- Step 1: DROP toàn bộ bảng ---
echo -e "${YELLOW}🗑️  Bước 1/3: DROP toàn bộ bảng hiện tại...${NC}"
DROP_SQL="DROP TABLE IF EXISTS parsing_logs; DROP TABLE IF EXISTS alerts; DROP TABLE IF EXISTS subscriptions; DROP TABLE IF EXISTS payment_cards; DROP TABLE IF EXISTS members; DROP TABLE IF EXISTS __drizzle_migrations;"

if npx wrangler d1 execute "$DB_NAME" $WRANGLER_FLAG --command "$DROP_SQL" 2>&1; then
  echo -e "${GREEN}   ✅ DROP thành công.${NC}"
else
  echo -e "${RED}   ❌ DROP thất bại.${NC}"
  exit 1
fi

echo ""

# --- Step 2: Chạy lại Drizzle Migrations ---
echo -e "${YELLOW}🔧 Bước 2/3: Chạy lại Drizzle Migrations...${NC}"

if npx wrangler d1 migrations apply "$DB_NAME" $WRANGLER_FLAG 2>&1; then
  echo -e "${GREEN}   ✅ Migrations applied thành công.${NC}"
else
  echo -e "${RED}   ❌ Migrations thất bại.${NC}"
  exit 1
fi

echo ""

# --- Step 3: Import file backup ---
echo -e "${YELLOW}📥 Bước 3/3: Import dữ liệu từ backup...${NC}"

if npx wrangler d1 execute "$DB_NAME" $WRANGLER_FLAG --file "$BACKUP_FILE" 2>&1; then
  echo -e "${GREEN}   ✅ Import thành công.${NC}"
else
  echo -e "${RED}   ❌ Import thất bại.${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  🎉 Restore hoàn tất!                        ║${NC}"
echo -e "${GREEN}║                                              ║${NC}"
echo -e "${GREEN}║  Database đã được khôi phục từ:              ║${NC}"
echo -e "${GREEN}║  📄 $(basename "$BACKUP_FILE")  ║${NC}"
echo -e "${GREEN}║                                              ║${NC}"
echo -e "${GREEN}║  Môi trường: ${ENV_TARGET}                          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}💡 Tip: Chạy health-check để xác nhận database hoạt động:${NC}"
if [ "$ENV_TARGET" = "local" ]; then
  echo -e "   curl http://localhost:8787/health-check"
else
  echo -e "   curl https://subsentry-backend.<your-subdomain>.workers.dev/health-check"
fi
echo ""
