#!/usr/bin/env bash
# ============================================================================
# 🛡️ SUBSENTRY — D1 Database Backup Script
# Epic 14, Task 14.1 — Disaster Recovery & Backup
# Ref: docs/disaster-recovery-fallback.md §4.1
# ============================================================================
set -euo pipefail

# --- Configuration ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKEND_DIR}/backups"
DB_NAME="subsentry-db"
RETENTION_DAYS=90
MIN_KEEP=3
DATE_TAG=$(date +"%Y-%m-%d")
BACKUP_FILE="${BACKUP_DIR}/backup-subsentry-${DATE_TAG}.sql"

# --- Colors ---
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  🛡️  Subsentry D1 Database Backup             ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# --- Step 1: Tạo thư mục backup nếu chưa có ---
mkdir -p "$BACKUP_DIR"

# --- Step 2: Kiểm tra wrangler ---
if ! command -v wrangler &> /dev/null && ! npx wrangler --version &> /dev/null 2>&1; then
  echo -e "${RED}❌ Không tìm thấy wrangler CLI. Cài đặt: npm i -g wrangler${NC}"
  exit 1
fi

# --- Step 3: Export D1 Database ---
echo -e "${YELLOW}📦 Đang export D1 Database '${DB_NAME}' (remote)...${NC}"
echo ""

cd "$BACKEND_DIR"

if npx wrangler d1 export "$DB_NAME" --remote --output "$BACKUP_FILE" 2>&1; then
  FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo ""
  echo -e "${GREEN}✅ Backup thành công!${NC}"
  echo -e "   📄 File: ${CYAN}${BACKUP_FILE}${NC}"
  echo -e "   📏 Kích thước: ${FILE_SIZE}"
  echo ""
else
  echo -e "${RED}❌ Export thất bại. Kiểm tra kết nối và quyền truy cập Cloudflare.${NC}"
  exit 1
fi

# --- Step 4: Cleanup — Xoá backup cũ hơn 90 ngày (giữ tối thiểu 3 bản) ---
echo -e "${YELLOW}🧹 Kiểm tra backup cũ (> ${RETENTION_DAYS} ngày, giữ tối thiểu ${MIN_KEEP} bản)...${NC}"

TOTAL_BACKUPS=$(find "$BACKUP_DIR" -name "backup-subsentry-*.sql" -type f | wc -l | tr -d ' ')

if [ "$TOTAL_BACKUPS" -gt "$MIN_KEEP" ]; then
  OLD_FILES=$(find "$BACKUP_DIR" -name "backup-subsentry-*.sql" -type f -mtime +"$RETENTION_DAYS" | sort)
  DELETABLE_COUNT=$(echo "$OLD_FILES" | grep -c . || true)

  # Chỉ xoá nếu sau khi xoá vẫn còn >= MIN_KEEP bản
  MAX_DELETABLE=$((TOTAL_BACKUPS - MIN_KEEP))

  DELETED=0
  while IFS= read -r file; do
    if [ -z "$file" ]; then continue; fi
    if [ "$DELETED" -ge "$MAX_DELETABLE" ]; then break; fi
    echo -e "   🗑️  Xoá: $(basename "$file")"
    rm -f "$file"
    DELETED=$((DELETED + 1))
  done <<< "$OLD_FILES"

  if [ "$DELETED" -gt 0 ]; then
    echo -e "${GREEN}   ✅ Đã xoá ${DELETED} bản backup cũ.${NC}"
  else
    echo -e "   ℹ️  Không có backup nào đủ cũ để xoá."
  fi
else
  echo -e "   ℹ️  Chỉ có ${TOTAL_BACKUPS} bản backup — chưa cần cleanup."
fi

echo ""

# --- Step 5: Nhắc nhở upload Google Drive ---
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  📤 NHẮC NHỞ: Upload lên Google Drive        ║${NC}"
echo -e "${CYAN}╠══════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}║                                              ║${NC}"
echo -e "${CYAN}║  Hãy copy file backup vào Google Drive       ║${NC}"
echo -e "${CYAN}║  cá nhân để đảm bảo an toàn dữ liệu:        ║${NC}"
echo -e "${CYAN}║                                              ║${NC}"
echo -e "${CYAN}║  📄 ${BACKUP_FILE##*/}  ║${NC}"
echo -e "${CYAN}║                                              ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}🎉 Backup hoàn tất! Chạy lại hàng tháng.${NC}"
echo ""
