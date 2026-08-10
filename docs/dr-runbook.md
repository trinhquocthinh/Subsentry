# 🛡️ SUBSENTRY — DR Runbook (Quy Trình Vận Hành Khôi Phục)

**Quick-Access Disaster Recovery Playbook** | _Dành cho Admin (Bố)_

**Document Version:** 1.0 | **Status:** Approved | **Last Updated:** 2026-08-10

---

## 📋 Checklist Backup Hàng Tháng

> Chạy vào **ngày 1 mỗi tháng** hoặc trước bất kỳ thay đổi lớn nào.

- [ ] Chạy script backup:
  ```bash
  yarn workspace @subsentry/backend db:backup
  ```
- [ ] Kiểm tra file output trong `apps/backend/backups/backup-subsentry-YYYY-MM-DD.sql`
- [ ] Upload file `.sql` lên Google Drive cá nhân (thư mục `Subsentry Backups`)
- [ ] Xác nhận kích thước file hợp lý (nên > 1KB, < 10MB cho gia đình 10 người)

---

## 🔧 Quy Trình Restore (Khôi Phục Dữ Liệu)

### Khi nào cần restore?

- Xóa nhầm bản ghi hoặc bảng
- Migration mới phá vỡ dữ liệu
- Cần quay về trạng thái database trước đó

### Bước thực hiện

**1. Diễn tập trên local trước (bắt buộc):**

```bash
yarn workspace @subsentry/backend db:restore -- --file ./backups/backup-subsentry-2026-08-01.sql --env local
```

**2. Xác nhận local hoạt động:**

```bash
yarn workspace @subsentry/backend dev
# Truy cập http://localhost:8787/health-check → phải trả "database: connected"
```

**3. Restore production (chỉ khi local OK):**

```bash
yarn workspace @subsentry/backend db:restore -- --file ./backups/backup-subsentry-2026-08-01.sql --env remote
```

> ⚠️ Script yêu cầu gõ `RESTORE-PROD` để xác nhận. Đây là hành động **không thể hoàn tác**.

**4. Verify production:**

```bash
curl https://subsentry-backend.<subdomain>.workers.dev/health-check
```

---

## 🤖 Quy Trình Xử Lý OpenAI Outage

### Triệu chứng

- Gửi biên lai vào Telegram Bot → nhận tin nhắn "AI đang bận"
- `parsing_logs` có nhiều bản ghi `status = 'FAILED'`

### Hệ thống tự xử lý

1. ✅ Lưu nội dung thô vào `parsing_logs` với `status = 'FAILED'`
2. ✅ Bot gửi tin nhắn thân thiện kèm link nhập tay Google Sheets
3. ✅ Cron retry ban đêm (01:00 UTC / 08:00 VN) quét `FAILED` → gửi lại OpenAI

### Admin can thiệp (nếu cần)

```bash
# Kiểm tra số lượng bản ghi FAILED
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  https://subsentry-backend.<subdomain>.workers.dev/api/admin/reconcile-sync
```

---

## 📊 Quy Trình Hòa Giải Dữ Liệu (D1 ↔ Google Sheets)

### Khi nào cần?

- Thành viên sửa tay trên Google Sheets → D1 chưa đồng bộ
- Mất mạng khi sync → dữ liệu lệch

### Thực hiện

```bash
curl -X POST \
  -H "Authorization: Bearer <ADMIN_API_TOKEN>" \
  https://subsentry-backend.<subdomain>.workers.dev/api/admin/reconcile-sync
```

> Google Sheets là **nguồn chân lý** (Single Source of Truth). Endpoint sẽ ghi đè D1 theo Sheets.

---

## 🗓️ Lịch Diễn Tập DR (Mỗi Quý)

| Quý | Hạng mục diễn tập                     | Checklist                       |
| --- | ------------------------------------- | ------------------------------- |
| Q1  | Backup + Restore local                | Script chạy OK, dữ liệu khớp    |
| Q2  | OpenAI outage simulation              | FAILED → retry → SUCCESS        |
| Q3  | Backup + Restore remote (staging)     | Full round-trip trên production |
| Q4  | Tổng hợp: backup + outage + reconcile | End-to-end DR drill             |

### Chạy automated DR test:

```bash
yarn workspace @subsentry/backend vitest run src/test/dr-drill.test.ts
```

---

## 📁 Vị Trí File Quan Trọng

| File                                 | Mục đích                                    |
| ------------------------------------ | ------------------------------------------- |
| `scripts/backup-d1.sh`               | Script backup tự động                       |
| `scripts/restore-d1.sh`              | Script restore 3 bước                       |
| `backups/`                           | Thư mục chứa file `.sql` (không commit Git) |
| `src/test/dr-drill.test.ts`          | Test suite diễn tập DR                      |
| `docs/disaster-recovery-fallback.md` | Đặc tả DR gốc                               |
