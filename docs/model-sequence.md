### 📊 SEQUENCE DIAGRAMS — Subsentry

**Sơ Đồ Tuần Tự Tương Tác Thời Gian Thực** | _UML Sequence Diagrams for Real-time Transaction Parsing and Alert Response_

**Document Version:** 1.2 | **Status:** Approved | **Last Updated:** 2026-08-10

---

#### 1. Luồng Bóc Tách Hóa Đơn Tự Động (Real-time Transaction Parsing Sequence)

Sơ đồ tuần tự này mô tả vòng đời của một giao dịch từ khi **Subscriber** chụp hóa đơn gửi vào Chatbot hoặc cấu hình chuyển tiếp email, đi qua bộ xử lý của **Cloudflare Workers** và **OpenAI API**, cho đến khi dữ liệu được lưu trữ, đồng bộ và phản hồi.

```mermaid
sequenceDiagram
    autonumber
    actor Sub as Subscriber (Thành viên)
    participant Bot as Chatbot Telegram
    participant CF_Mail as Cloudflare Email Routing
    participant Worker as Cloudflare Workers (Backend)
    participant AI as OpenAI API (GPT-4o-mini)
    participant D1 as Cloudflare D1 (Database)
    participant Sheets as Google Sheets / Notion

    alt Kênh Chatbot (Ảnh chụp biên lai / SMS Copy)
        Sub->>Bot: Gửi ảnh biên lai đăng ký hoặc dán nội dung SMS
        Bot->>Worker: Kích hoạt Webhook POST Event (Chứa nội dung / URL ảnh)
    else Kênh Email (Auto-forward)
        Sub->>CF_Mail: Auto-forward email biên lai tới subs@yourfamily.com
        CF_Mail->>Worker: POST email payload (Body Text/HTML thô)
    end

    activate Worker
    Worker->>Worker: Chuẩn hóa dữ liệu đầu vào (Sanitize & Prepare)

    Worker->>AI: Gọi API bóc tách (Gửi prompt kèm nội dung thô / URL ảnh)
    activate AI
    AI-->>Worker: Trả về JSON (Merchant, Amount, Next Billing, Confidence)
    deactivate AI

    alt TH1: Confidence Score >= 0.85 (AI Phân tích tin cậy)
        Worker->>D1: Ghi nhận dữ liệu vào bảng `subscriptions` (Trạng thái: ACTIVE / TRIAL)
        activate D1
        D1-->>Worker: Lưu trữ thành công
        deactivate D1

        Worker->>Sheets: Gọi API đồng bộ ghi nhận dòng mới (2-way Sync)
        activate Sheets
        Sheets-->>Worker: Đồng bộ Sheets thành công
        deactivate Sheets

        Worker->>Bot: Gửi tin nhắn private thông báo đã lưu tự động thành công
        Bot-->>Sub: Hiển thị: "Đã tự động ghi nhận Netflix (260k), gia hạn ngày..."

    else TH2: Confidence Score < 0.85 (AI Phân tích không tin cậy)
        Worker->>D1: Ghi log vào bảng `parsing_logs` (Trạng thái: LOW_CONFIDENCE)
        activate D1
        D1-->>Worker: Lưu log thành công
        deactivate D1

        Worker->>Bot: Gửi tin nhắn tương tác kèm nút bấm xác nhận
        Bot-->>Sub: Hiển thị: "Hệ thống nhận diện không rõ ràng. Có phải bạn mua Canva 250k? [Đúng] | [Sửa đổi]"

        Sub->>Bot: Bấm nút "Xác nhận đúng"
        Bot->>Worker: POST Webhook phản hồi của Subscriber

        Worker->>D1: Cập nhật `parsing_logs` thành SUCCESS & ghi nhận vào `subscriptions`
        Worker->>Sheets: Đồng bộ dữ liệu sang Google Sheets
        Worker->>Bot: Xác nhận lưu thành công
        Bot-->>Sub: Hiển thị: "Đã ghi nhận dịch vụ vào danh sách."
    end
    deactivate Worker
```

---

#### 2. Luồng Phản Hồi Cảnh Báo Đa Tầng & Leo Thang (Escalation Alert & Response Sequence)

Sơ đồ mô tả chi tiết quy trình xử lý khi mốc thời gian trừ tiền đến gần. Mô tả sự phối hợp giữa bộ lập lịch **Cron Trigger**, phản hồi riêng tư của **Subscriber** (T-3), và cơ chế báo động leo thang khẩn cấp gửi tới **Card Owner** (T-24h) trên nhóm chat chung.

```mermaid
sequenceDiagram
    autonumber
    participant Cron as Cloudflare Cron Trigger (08:00 AM)
    participant Worker as Cloudflare Workers (Backend)
    participant D1 as Cloudflare D1 (Database)
    participant Bot as Chatbot Telegram
    actor Sub as Subscriber (Thành viên)
    actor Owner as Card Owner (Bố/Mẹ - Chủ thẻ)

    Cron->>Worker: Kích hoạt tác vụ quét hàng ngày
    activate Worker
    Worker->>D1: Lấy danh sách Subscription sắp đến hạn gia hạn
    activate D1
    D1-->>Worker: Trả về danh sách các gói
    deactivate D1

    loop Duyệt từng Subscription sắp gia hạn
        alt TH1: Còn đúng T-3 ngày (Gửi Soft Alert)
            Worker->>D1: Tạo bản ghi cảnh báo `SOFT_T3` trạng thái `SCHEDULED`
            Worker->>Bot: Gọi API gửi tin nhắn riêng tư (Private Chat)
            Bot-->>Sub: Gửi tin nhắn: "Netflix sắp gia hạn sau 3 ngày nữa. [Keep] | [Kill]"
            Worker->>D1: Cập nhật trạng thái alert thành `SENT`

        else TH2: Còn đúng T-1 ngày (Kiểm tra phản hồi & Báo động leo thang)
            Worker->>D1: Kiểm tra xem đã nhận phản hồi từ SOFT_T3 chưa?
            activate D1
            D1-->>Worker: Trả về trạng thái phản hồi
            deactivate D1

            alt Chưa phản hồi && Gói không thuộc diện Must-Keep
                Worker->>D1: Tạo bản ghi cảnh báo `RED_T24` trạng thái `SENT`
                Worker->>Bot: Gọi API gửi tin nhắn vào NHÓM CHAT CHUNG GIA ĐÌNH
                Bot-->>Owner: Tag Bố/Mẹ (Card Owner) + Con (Subscriber)
                Note over Bot,Owner: Báo động: "Thẻ Bố sắp bị trừ 260,000 VND cho Netflix của Con. Vui lòng xác nhận!"

                alt Phương án khẩn cấp: Hủy dịch vụ
                    Owner->>Sub: Yêu cầu xử lý hủy gói ngay lập tức
                    Sub->>Bot: Click nút "Kill" trên chatbot
                    Bot->>Worker: POST Webhook: Cập nhật trạng thái thành PENDING_KILL
                    Worker->>D1: Cập nhật trạng thái subscription thành `PENDING_KILL`
                    Worker->>Bot: Gửi Link Hủy trực tiếp (Direct Kill Link) cho Subscriber
                    Bot-->>Sub: Link hủy: "Hủy Netflix tại: netflix.com/youraccount"
                else Phương án khẩn cấp: Khóa thẻ tạm thời
                    Note over Owner: Chủ thẻ mở app Ngân hàng và thực hiện khóa thẻ tạm thời để chặn giao dịch tự động trừ tiền
                end

            else Đã phản hồi hoặc Thuộc diện Must-Keep
                Note over Worker: Không gửi cảnh báo khẩn cấp (Tránh làm phiền gia đình)
            end
        end
    end
    deactivate Worker
```
