### 🛡️ SUBSENTRY — DISASTER RECOVERY & FALLBACK RUNBOOK

**Quy Trình Khôi Phục & Xử Lý Sự Cố Hệ Thống** | _Zero-Ops Resilient QoL Infrastructure_

**Document Version:** 1.2 | **Status:** Approved | **Last Updated:** 2026-08-10

Quy trình này cung cấp hướng dẫn chi tiết nhằm đảm bảo tính liên tục của hệ thống **Subsentry** phục vụ gia đình 10 thành viên. Dù chạy trên hạ tầng Serverless miễn phí và có độ tin cậy cao của Cloudflare, hệ thống vẫn phải chuẩn bị sẵn các kịch bản đối phó với sự cố kỹ thuật từ bên thứ ba (như sập API OpenAI, lỗi đồng bộ Google Sheets, lỗi nghẽn mạng...).

---

#### 1. Sự Cố 1: Sập Hoặc Nghẽn API OpenAI (OpenAI Outage Fallback)

Khi hệ thống không thể kết nối tới API OpenAI hoặc tài khoản API hết tiền hạn mức (Quota exceeded).

##### 1.1 Triệu chứng (Symptoms)

- Thành viên gửi biên lai vào Telegram Bot nhưng không nhận được phản hồi, hoặc nhận được tin nhắn báo lỗi hệ thống bóc tách.
- Nhật ký `parsing_logs` ghi nhận trạng thái giao dịch xử lý thất bại (`status = 'FAILED'`).

##### 1.2 Giải pháp khắc phục tự động (Automated Fallback)

Trong mã nguồn Cloudflare Worker, thực hiện cơ chế bọc khối lệnh gọi OpenAI (`try/catch`) để kích hoạt luồng xử lý dự phòng:

1.  **Lưu trữ thô**: Lưu toàn bộ nội dung thô (Email HTML/Văn bản hoặc link ảnh biên lai) vào cơ sở dữ liệu D1 với trạng thái `status = 'FAILED'`.
2.  **Thông báo thân thiện**: Bot gửi tin nhắn phản hồi nhanh cho thành viên:
    _"Hệ thống bóc tách tự động bằng AI của gia đình hiện đang bận hoặc bảo trì tạm thời. Đừng lo lắng, biên lai của bạn đã được lưu trữ an toàn. Bạn có muốn nhập thông tin nhanh thủ công tại link sau không? [Nhấp vào đây để nhập thủ công]"_ (đường dẫn dẫn trực tiếp đến Google Sheets/Notion Dashboard của gia đình).
3.  **Hàng đợi Re-try (Tùy chọn)**: Thiết lập một tác vụ Cron chạy hằng đêm để quét các bản ghi `parsing_logs` có trạng thái `FAILED`, thử gửi lại yêu cầu bóc tách sang OpenAI API lần nữa khi dịch vụ của họ ổn định trở lại.

---

#### 2. Sự Cố 2: Lỗi Webhook Không Phản Hồi Đúng Hạn (Webhook Timeout Handling)

Telegram Bot API yêu cầu phản hồi HTTP `200 OK` cực kỳ nhanh (thường trong vòng 2 - 3 giây) sau khi gửi webhook payload. Nếu Cloudflare Worker tốn quá nhiều thời gian để gọi API OpenAI bóc tách hình ảnh (thao tác này có thể mất từ 3 - 5 giây), Telegram Server sẽ coi là kết nối bị lỗi và tự động gửi lại (retry) nhiều lần, gây ra hiện tượng trùng lặp yêu cầu và lãng phí chi phí gọi API OpenAI.

##### 2.1 Giải pháp thiết kế kỹ thuật (Non-Blocking Webhook)

Áp dụng cơ chế bất đồng bộ hóa xử lý (Async Execution) sử dụng hàm `ctx.waitUntil` có sẵn của Cloudflare Workers:

1.  **Nhận & Xác thực**: Worker tiếp nhận Webhook POST từ Telegram.
2.  **Trả về HTTP 200 ngay lập tức**: Phản hồi ngay lập tức cho Telegram Server mã trạng thái `200 OK` để xác nhận đã nhận dữ liệu thành công.
3.  **Xử lý ngầm (Background Processing)**: Đẩy tác vụ gọi OpenAI API, ghi nhận cơ sở dữ liệu D1 và gửi tin nhắn thông báo cho người dùng vào luồng chạy ngầm bằng `ctx.waitUntil()`:
    ```typescript
    app.post('/webhook/telegram', async (c) => {
      const payload = await c.req.json();

      // Chạy ngầm tiến trình bóc tách để trả về kết quả HTTP 200 ngay lập tức
      c.executionCtx.waitUntil(processTelegramWebhookInBackground(payload, c.env));

      return c.text('OK', 200);
    });
    ```

---

#### 3. Sự Cố 3: Đồng Bộ Sai Lệch Dữ Liệu (Data Drift - D1 vs. Google Sheets)

Do các thành viên gia đình chỉnh sửa trực tiếp thông tin bằng tay trên Google Sheets/Notion Dashboard, hoặc do sự cố mất mạng khiến việc đồng bộ thay đổi từ D1 lên Google Sheets bị gián đoạn.

##### 3.1 Quy trình Hòa giải và Đồng bộ cưỡng bức (Force Reconcile Runbook)

Thiết lập một đường dẫn API ẩn (Protected Endpoint) trên Cloudflare Worker chỉ có Admin (bạn) có quyền kích hoạt chạy:

- **Endpoint**: `POST /api/admin/reconcile-sync`
- **Xác thực**: Request bắt buộc phải gửi kèm header `Authorization: Bearer <ADMIN_API_TOKEN>`. Token được lưu trong Cloudflare Secrets (`wrangler secret put ADMIN_API_TOKEN`); Worker từ chối (`401 Unauthorized`) ngay lập tức mọi request thiếu hoặc sai token trước khi chạm vào logic đồng bộ.
- **Hành động**:
  1.  Tải toàn bộ dữ liệu hiện tại từ Google Sheet.
  2.  Tải toàn bộ cơ sở dữ liệu từ Cloudflare D1.
  3.  Lấy bảng dữ liệu trên Google Sheets làm nguồn chân lý duy nhất (Single Source of Truth).
  4.  Cập nhật ghi đè hoặc bổ sung các bản ghi sai lệch vào D1 Database.
  5.  Sau khi hoàn tất, gửi tin nhắn thông báo xác nhận đồng bộ thành công vào nhóm chat gia đình.

---

#### 4. Sự Cố 4: Mất Mát Dữ Liệu D1 Database (Backup & Restore Runbook)

Dù Cloudflare D1 có độ ổn định rất cao, việc chủ động sao lưu (Backup) dữ liệu đề phòng tình huống sửa nhầm code hoặc xóa nhầm bản ghi là tối quan trọng đối với một kỹ sư chuyên nghiệp.

##### 4.1 Quy trình Sao lưu dữ liệu thủ công (Manual Backup)

Sử dụng Wrangler CLI để xuất khẩu (export) toàn bộ dữ liệu SQLite hiện tại của bạn về một tệp SQL cục bộ trên máy tính cá nhân:

```bash
# Xuất khẩu toàn bộ dữ liệu của D1 Database về máy cá nhân
yarn workspace @subsentry/backend wrangler d1 export subsentry-db --remote --output ./backup-subsentry.sql
```

_Lời khuyên: Bạn nên chạy câu lệnh này mỗi tháng một lần và lưu trữ tệp `.sql` vào hòm thư hoặc ổ đĩa Google Drive cá nhân._

##### 4.2 Quy Trình Khôi Phục Dữ Liệu (Restore)

Khi có sự cố phá hủy cơ sở dữ liệu và cần quay lại bản sao lưu cũ:

1.  **Bước 1**: Xóa sạch dữ liệu lỗi hiện tại trên Cloudflare D1:
    ```bash
    yarn workspace @subsentry/backend wrangler d1 execute subsentry-db --remote --command "DROP TABLE IF EXISTS members; DROP TABLE IF EXISTS payment_cards; DROP TABLE IF EXISTS subscriptions; DROP TABLE IF EXISTS alerts; DROP TABLE IF EXISTS parsing_logs;"
    ```
2.  **Bước 2**: Thực hiện chạy các tệp Migration của Drizzle để tái tạo lại cấu trúc bảng sạch:
    ```bash
    yarn workspace @subsentry/backend wrangler d1 migrations apply subsentry-db --remote
    ```
3.  **Bước 3**: Nhập khẩu (import) lại tệp dữ liệu đã sao lưu trước đó:
    ```bash
    yarn workspace @subsentry/backend wrangler d1 execute subsentry-db --remote --file ./backup-subsentry.sql
    ```
    _Hệ thống sẽ tái thiết lập hoàn chỉnh cơ sở dữ liệu về thời điểm sao lưu gần nhất một cách hoàn hảo._
