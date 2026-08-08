### 🧪 SUBSENTRY — TEST CASES & TEST VECTORS SPECIFICATION

**Tài Liệu Đặc Tả Kịch Bản Kiểm Thử & Bộ Dữ Liệu Giả Lập** | _Strict Test-Driven QoL Engineering_

**Document Version:** 1.0 | **Status:** Approved

Tài liệu này đặc tả chi tiết bộ kịch bản kiểm thử (Test Cases), các kịch bản biên (Edge Cases), và các dữ liệu giả lập (Mock Payloads / Test Vectors) phục vụ cho quá trình kiểm thử tự động bằng **Vitest** trên môi trường mô phỏng **Miniflare** (Cloudflare Workers).

---

#### 1. Cấu Hình & Thiết Lập Môi Trường Kiểm Thử (Vitest Setup)

Để viết kiểm thử tương thích với Cloudflare Worker và cơ sở dữ liệu Cloudflare D1 local, chúng ta sử dụng tệp cấu hình `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 85, // Bắt buộc độ phủ tối thiểu 85% dòng code theo Techspec
        functions: 90,
        branches: 80,
      },
    },
  },
});
```

---

#### 2. Bộ Dữ Liệu Giả Lập Đầu Vào (Mock Payloads / Test Vectors)

##### 2.1 Telegram Bot API Webhook Payloads (Telegram Bot)

###### Kịch bản 2.1.1: Thành viên tương tác nút bấm Inline Keyboard (Callback Query)

```json
{
  "update_id": 900112235,
  "callback_query": {
    "id": "cbq-998877",
    "from": {
      "id": 224466,
      "is_bot": false,
      "first_name": "Con Cả"
    },
    "message": {
      "message_id": 458,
      "chat": {
        "id": 224466,
        "type": "private"
      }
    },
    "data": "ACTION_KILL_SUB_ID_456"
  }
}
```

##### 2.2 Cloudflare Email Routing Webhook Payload

Dữ liệu Email chuyển tiếp tự động nhận từ Gmail thông qua Cloudflare Email Routing và chuyển đổi thành HTTP POST:

```json
{
  "from": "forwarding-filter@gmail.com",
  "to": "subs@yourfamily.com",
  "subject": "Fwd: Your Netflix Invoice - Subscription Renewal",
  "headers": {
    "date": "Sun, 02 Aug 2026 18:00:00 +0700"
  },
  "html": "<html><body>Your Netflix Premium package has been renewed successfully on Aug 2, 2026. Amount: 260,000 VND. Next billing date: Sep 2, 2026.</body></html>",
  "text": "Your Netflix Premium package has been renewed successfully on Aug 2, 2026. Amount: 260,000 VND. Next billing date: Sep 2, 2026."
}
```

---

#### 3. Các Kịch Bản Kiểm Thử Nghiệp Vụ Cốt Lõi (Core Business Scenarios)

##### Kịch bản 3.1: Chuyển đổi trạng thái Máy Trạng Thái (State Transitions)

Đảm bảo máy trạng thái vận hành chuẩn xác theo quy tắc **BR-03** và **BR-04** của tài liệu nghiệp vụ.

| STT       | Trạng thái bắt đầu | Đầu vào (Hành động)                   | Trạng thái kết thúc kỳ vọng | Hàm Unit Test liên quan             |
| :-------- | :----------------- | :------------------------------------ | :-------------------------- | :---------------------------------- |
| **TC-01** | `TRIAL`            | Thành viên bấm nút **Keep** (Giữ)     | `ACTIVE`                    | `transitionState('KEEP')`           |
| **TC-02** | `TRIAL`            | Thành viên bấm nút **Kill** (Hủy)     | `PENDING_KILL`              | `transitionState('KILL')`           |
| **TC-03** | `ACTIVE`           | Thành viên bấm nút **Kill** (Hủy)     | `PENDING_KILL`              | `transitionState('KILL')`           |
| **TC-04** | `PENDING_KILL`     | Thành viên xác nhận đã hủy thành công | `KILLED`                    | `transitionState('CONFIRM_KILLED')` |
| **TC-05** | `KILLED`           | Nhận email hóa đơn phát sinh mới      | `ACTIVE`                    | `handleIncomingInvoice()`           |

##### Kịch bản 3.2: Kiểm duyệt chất lượng phân tích của AI (AI Confidence Score - BR-07)

Đảm bảo hệ thống bảo vệ chất lượng dữ liệu sạch thông qua cơ chế kiểm duyệt ngưỡng tin cậy của OpenAI.

- **TC-06: Tự động ghi nhận khi Confidence Score >= 0.85**
  - _Dữ liệu đầu vào_: GPT-4o-mini trả về JSON:
    ```json
    {
      "merchant": "Netflix",
      "amount": 260000,
      "currency": "VND",
      "next_billing_date": "2026-09-02",
      "confidence_score": 0.98
    }
    ```
  - _Hành vi mong đợi_:
    1.  Worker tự động chèn bản ghi mới vào bảng `subscriptions` trong SQLite D1.
    2.  Ứng dụng gửi tin nhắn xác nhận tự động qua chat cho thành viên.
    3.  Đồng bộ dữ liệu sang Google Sheets tức thì.

- **TC-07: Yêu cầu xác nhận lại thủ công khi Confidence Score < 0.85**
  - _Dữ liệu đầu vào_: GPT-4o-mini trả về JSON:
    ```json
    {
      "merchant": "Unknown Merchant",
      "amount": 150000,
      "currency": "VND",
      "next_billing_date": "2026-08-15",
      "confidence_score": 0.62
    }
    ```
  - _Hành vi mong đợi_:
    1.  **Tuyệt đối không** ghi tự động vào cơ sở dữ liệu D1.
    2.  Gửi tin nhắn đề xuất kèm nút bấm cấu trúc để thành viên bấm xác nhận: _"Hệ thống bóc tách không chắc chắn về biên lai này. Có phải bạn vừa đăng ký Unknown Merchant giá 150.000 VND không?"_.

##### Kịch bản 3.3: Ngoại lệ đối với dịch vụ thiết yếu (Must-Keep Exemption - BR-05)

- **TC-08: Gói cước YouTube Premium được cấu hình `is_must_keep = true`**
  - _Hành vi mong đợi_: Khi hệ thống chạy tác vụ Cron quét hằng ngày, không bao giờ gửi cảnh báo **Red Alert (T-24h)** ra nhóm chat chung của gia đình đối với gói YouTube Premium, ngay cả khi Subscriber không phản hồi Soft Alert. Hệ thống chỉ ghi nhận và đưa vào báo cáo chi tiêu cuối tháng.

---

#### 4. Kịch Bản Kiểm Thử Các Tình Huống Đặc Biệt (Edge Cases)

##### TC-09: Hóa đơn biên lai dùng thử trị giá "0đ" (Free Trial)

- _Đặc điểm dữ liệu_: Biên lai email/giao dịch ghi nhận giá trị thanh toán là `0 VND` hoặc `Free`.
- _Hành vi mong đợi_: AI bóc tách chính xác số tiền `amount = 0`, trạng thái ban đầu của subscription lưu là `TRIAL`. Next Billing Date được tự động tính toán cộng thêm 7 ngày (mặc định nếu không phân tích được chu kỳ dùng thử) hoặc bóc tách đúng thời hạn dùng thử ghi trong text email.

##### TC-10: Biên lai hóa đơn không ghi năm thanh toán

- _Đặc điểm dữ liệu_: Biên lai chỉ ghi nội dung: _"Hết hạn vào ngày 05/09"_ (không ghi năm 2026).
- _Hành vi mong đợi_: Mã nguồn xử lý bóc tách của Worker phải tự động lấy thời gian hệ thống tại thời điểm chạy (Current Local Time) để suy luận năm thích hợp. Nếu thời điểm hiện tại là tháng 8/2026, ngày hết hạn 05/09 sẽ được hiểu là `2026-09-05`. Nếu thời điểm hiện tại là tháng 12/2026, ngày hết hạn 05/01 sẽ được hiểu là `2027-01-05`.

##### TC-11: Trùng lặp dịch vụ gia đình (Redundancy Detection)

- _Đặc điểm dữ liệu_: Thành viên A gửi hóa đơn đăng ký Spotify cá nhân (Spotify Individual). Một tuần sau, thành viên B gửi hóa đơn Spotify cá nhân tương tự.
- _Hành vi mong đợi_: Hệ thống truy vấn SQLite D1 phát hiện hai bản ghi Spotify đang hoạt động của hai thành viên khác nhau. Gửi tin nhắn gợi ý chung: _"Phát hiện gia đình đang sử dụng 2 gói Spotify cá nhân. Khuyên dùng: Chuyển đổi sang gói Spotify Family để tiết kiệm 45,000 VND/tháng."_
