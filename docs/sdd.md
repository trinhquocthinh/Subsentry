# 📑 SPEC-DRIVEN DEVELOPMENT (SDD) — Subsentry

**Tài Liệu Đặc Tả Trạng Thái & Thiết Kế API Webhook** | _Spec-Driven Engineering for Reliable Family Automation_

| Document Metadata          | Details                            |
| -------------------------- | ---------------------------------- |
| **Document Version**       | 1.0                                |
| **Target Architecture**    | Cloudflare Workers & Cloudflare D1 |
| **Integration Interfaces** | Telegram Bot API, OpenAI API       |
| **Status**                 | Approved                           |

---

## 1. Subscription State Machine (Máy Trạng Thái Dịch Vụ)

Mỗi dịch vụ đăng ký (Subscription/Trial) lưu trữ trong Cloudflare D1 Database tuân thủ nghiêm ngặt theo máy trạng thái (Finite State Machine) dưới đây.

```
          [ Hóa đơn dùng thử ]           [ Hóa đơn trả phí ]
                   │                              │
                   ▼                              ▼
             ┌───────────┐                  ┌───────────┐
             │   TRIAL   ├─────────────────►│  ACTIVE   │
             └─────┬─────┘                  └─────┬─────┘
                   │                              │
          (Chọn "Kill" ở T-3)            (Chọn "Kill" ở T-3)
                   │                              │
                   ▼                              ▼
             ┌────────────────────────────────────┴─────┐
             │               PENDING_KILL               │
             └────────────────────┬─────────────────────┘
                                  │
                       (Xác nhận đã hủy thực tế)
                                  │
                                  ▼
             ┌──────────────────────────────────────────┐
             │                  KILLED                  │
             └──────────────────────────────────────────┘
```

> ⚠️ **Lưu ý:** `KILLED` không phải trạng thái tuyệt đối cuối cùng. Nếu phát hiện hóa đơn phát sinh mới cho cùng dịch vụ, subscription được mở lại (reopen) và quay thẳng về `ACTIVE`/`TRIAL` (xem chi tiết ở mục 1.1 — trạng thái `KILLED`).

### 1.1 Chi Tiết Các Trạng Thái & Điều Kiện Chuyển Đổi (Transitions)

- **TRIAL (Dùng thử):**
  - _Đầu vào:_ AI nhận diện email/ảnh biên lai có chữ "dùng thử", "free trial", "0đ" hoặc ngày kết thúc cực ngắn (7 ngày, 14 ngày, 30 ngày) [8].
  - _Hành vi:_ Đặt mức ưu tiên cảnh báo cao nhất. Tự động lên lịch Soft Alert vào mốc `Next Billing Date - 3 days` [8].
  - _Chuyển trạng thái:_
    - Chuyển sang `ACTIVE` nếu người dùng chọn nút **Keep** khi nhận Soft Alert, hoặc hệ thống phát hiện hóa đơn trả phí chu kỳ tiếp theo [10].
    - Chuyển sang `PENDING_KILL` nếu người dùng chọn nút **Kill** [10].
- **ACTIVE (Đang hoạt động):**
  - _Đầu vào:_ Phát hiện biên lai trả tiền đầy đủ định kỳ [8].
  - _Hành vi:_ Lên lịch Soft Alert ở mốc `Next Billing Date - 3 days` để xác nhận xem gia đình còn có nhu cầu sử dụng dịch vụ này nữa không [10].
  - _Chuyển trạng thái:_ Chuyển sang `PENDING_KILL` nếu người dùng chọn nút **Kill** [10].
- **PENDING_KILL (Chờ hủy):**
  - _Ý nghĩa:_ Thành viên đã chọn "Kill" trên chatbot (hoặc Google Sheet) [10]. Hệ thống cung cấp **Direct Kill Link** hướng dẫn thành viên vào hủy thủ công trên trang của nhà cung cấp [10].
  - _Hành vi:_ Trạng thái này đóng vai trò nhắc nhở thành viên thực hiện thao tác hủy thực tế trên dịch vụ để tránh thẻ bị trừ tiền thật.
  - _Chuyển trạng thái:_ Chuyển sang `KILLED` sau khi thành viên bấm nút "Xác nhận đã hủy thành công" trên Bot.
- **KILLED (Đã hủy):**
  - _Hành vi:_ Đóng chu kỳ giám sát. Không gửi bất kỳ cảnh báo nào nữa trừ khi phát hiện hóa đơn phát sinh mới của dịch vụ đó trong tương lai [2, 10].
  - _Chuyển trạng thái:_ Nếu Worker nhận được hóa đơn mới cho cùng merchant + subscriber (dịch vụ được đăng ký lại), subscription được **mở lại (reopen)** và chuyển thẳng sang `ACTIVE` (hoặc `TRIAL` nếu hóa đơn ghi nhận là dùng thử mới) thông qua `handleIncomingInvoice()`, bỏ qua `PENDING_KILL`. Xem thêm TC-05 trong tài liệu Test Cases.

---

## 2. API & Webhook Payloads Specification (Đặc Tả Payload API)

### 2.1 Telegram Bot API Webhook Payload

Hệ thống đăng ký Webhook với Telegram Bot API (gọi một lần API `setWebhook` kèm `secret_token`) để tiếp nhận tin nhắn từ thành viên qua Telegram. Telegram gửi mọi sự kiện dưới dạng đối tượng `Update` duy nhất tới endpoint đã đăng ký:

#### 💬 2.1.1 Payload tin nhắn văn bản từ Telegram (SMS copy):

```json
{
  "update_id": 900112233,
  "message": {
    "message_id": 456,
    "from": {
      "id": 887766,
      "is_bot": false,
      "first_name": "Con"
    },
    "chat": {
      "id": 887766,
      "type": "private"
    },
    "date": 1785635043,
    "text": "TK 12345678 bien dong -250,000VND vao 02/08/2026. ND: GD tu CANVA.COM"
  }
}
```

#### 📸 2.1.2 Payload ảnh chụp màn hình biên lai (photo):

```json
{
  "update_id": 900112234,
  "message": {
    "message_id": 457,
    "from": {
      "id": 887766,
      "is_bot": false,
      "first_name": "Con"
    },
    "chat": {
      "id": 887766,
      "type": "private"
    },
    "date": 1785635045,
    "photo": [
      {
        "file_id": "AgACAgIAAxkBAAI_photo_id_998877",
        "width": 1080,
        "height": 1920
      }
    ]
  }
}
```

#### 🔘 2.1.3 Payload bấm nút Inline Keyboard (Keep/Kill):

```json
{
  "update_id": 900112235,
  "callback_query": {
    "id": "cbq_998877",
    "from": {
      "id": 887766,
      "is_bot": false,
      "first_name": "Con"
    },
    "message": {
      "message_id": 458,
      "chat": {
        "id": 887766,
        "type": "private"
      }
    },
    "data": "ACTION_KILL_SUB_ID_456"
  }
}
```

---

### 2.2 Cloudflare Email Routing Payload

Email tự động chuyển tiếp từ Gmail cá nhân của thành viên sẽ được Cloudflare chuyển thành cấu hình webhook HTTP POST gửi trực tiếp tới Cloudflare Worker:

```json
{
  "from": "member-email@gmail.com",
  "to": "subs@yourfamily.com",
  "subject": "Fwd: Your Apple Receipt - Subscription Confirmation",
  "text": "---------- Forwarded message ---------\nFrom: Apple <no_reply@apple.com>\nDate: Sun, Aug 2, 2026\nSubject: Receipt for iCloud+ with 2TB storage. Price: 199.000 VND/month. Next billing date: 02/09/2026",
  "html": "<p>Receipt details here...</p>"
}
```

---

## 3. OpenAI GPT-4o-mini Integration Specification (Đặc Tả Phân Tích AI)

### 3.1 Strict JSON Schema Definition (Cấu trúc trả về bắt buộc)

Để đảm bảo Cloudflare Worker có thể đọc và lưu trữ dữ liệu vào database SQLite D1 mà không gặp lỗi parse, API gọi OpenAI GPT-4o-mini bắt buộc phải cấu hình tham số `response_format: { type: "json_schema" }` kèm theo prompt ép kiểu JSON nghiêm ngặt dưới đây:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "SubscriptionExtraction",
  "type": "object",
  "properties": {
    "merchant": {
      "type": "string",
      "description": "Normalized name of the service provider (e.g., Netflix, Apple, Spotify, Canva, OpenAI, Adobe, Youtube)"
    },
    "amount": {
      "type": "number",
      "description": "The exact numeric payment amount parsed from the document"
    },
    "currency": {
      "type": "string",
      "description": "Standardized currency code (VND, USD, EUR, etc.)"
    },
    "is_trial": {
      "type": "boolean",
      "description": "True if the billing receipt explicitly mentions free trial, 0đ registration, or trial period"
    },
    "next_billing_date": {
      "type": "string",
      "format": "date",
      "description": "Next billing date in ISO format (YYYY-MM-DD). If not found, compute as receipt_date + 30 days (for subscription) or + 7 days (for trial)"
    },
    "confidence_score": {
      "type": "number",
      "minimum": 0.0,
      "maximum": 1.0,
      "description": "Confidence level of parsed data. Must be set to < 0.85 if some fields are guessed or unclear"
    }
  },
  "required": [
    "merchant",
    "amount",
    "currency",
    "is_trial",
    "next_billing_date",
    "confidence_score"
  ]
}
```

### 3.2 Barems Xử Lý Độ Tin Cậy (Confidence Score Rule)

1. **Confidence Score >= 0.85:**
   - Thao tác: Cloudflare Worker tự động ghi nhận trực tiếp vào bảng `subscriptions` trong Cloudflare D1 Database [9].
   - Phản hồi: Gửi tin nhắn xác nhận cho thành viên qua Telegram: _"Hệ thống đã tự động ghi nhận dịch vụ **Netflix** (260.000 VND), hạn gia hạn kế tiếp là **02/09/2026**. Trạng thái: **Active**."_
2. **Confidence Score < 0.85:**
   - Thao tác: **Không** lưu trữ tự động vào cơ sở dữ liệu.
   - Phản hồi: Gửi tin nhắn kèm cấu trúc dữ liệu thô yêu cầu thành viên xác nhận thủ công bằng cách bấm nút: _"Hệ thống bóc tách không chắc chắn về biên lai này. Có phải bạn vừa đăng ký **Canva** với giá **250.000 VND** không? [Xác nhận đúng] | [Nhập lại thủ công]"_ [11].

---

## 4. Xác Thực Webhook Đầu Vào (Inbound Webhook Signature Verification)

Để ngăn chặn giả mạo payload (spoofing) gửi trực tiếp tới endpoint Worker mà không thông qua Telegram/Cloudflare Email Routing thật, mọi webhook endpoint bắt buộc phải xác thực nguồn gốc trước khi xử lý dữ liệu.

### 4.1 Telegram Bot Webhook

- Khi đăng ký webhook qua `setWebhook`, Worker truyền kèm tham số `secret_token` (giá trị chính là `TELEGRAM_WEBHOOK_SECRET`).
- Từ thời điểm đó, mọi request Telegram gửi tới endpoint sẽ kèm header `X-Telegram-Bot-Api-Secret-Token`. Worker so sánh (constant-time) giá trị header với `TELEGRAM_WEBHOOK_SECRET` đang lưu trong Cloudflare Secrets; từ chối (`401 Unauthorized`) nếu không khớp hoặc thiếu header.

### 4.2 Cloudflare Email Routing

- Email Worker chạy trong cùng tài khoản Cloudflare nên không cần xác thực chữ ký bổ sung, nhưng route rule phải giới hạn chỉ nhận email gửi đúng tới địa chỉ `subs@yourfamily.com` để tránh bị lạm dụng làm relay trung gian.

### 4.3 Bảo Vệ Endpoint Quản Trị (Admin Endpoint)

- Endpoint `POST /api/admin/reconcile-sync` (xem `disaster-recovery-fallback.md`) bắt buộc yêu cầu header `Authorization: Bearer <ADMIN_API_TOKEN>` với token lưu trong Cloudflare Secrets (`ADMIN_API_TOKEN`), không dùng chung với bất kỳ token nào khác. Request thiếu hoặc sai token phải bị từ chối ngay với `401 Unauthorized`.
