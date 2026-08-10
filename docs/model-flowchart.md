### 📊 BUSINESS FLOWCHARTS — Subsentry

**Lưu Đồ Nghiệp Vụ Xử Lý Dữ Liệu & Cảnh Báo Đa Tầng** | _Visual Flowcharts detailing AI Parsing Validation & Escalation Logic_

**Document Version:** 1.2 | **Status:** Approved | **Last Updated:** 2026-08-10

---

#### 1. Lưu Đồ Xử Lý & Xác Thực Biên Lai Bằng AI (AI Parsing Validation)

Lưu đồ dưới đây thể hiện quy trình khép kín khi hệ thống nhận diện biên lai (Email forwarded hoặc Ảnh chụp màn hình gửi qua Chatbot), chuyển dịch qua mô hình **GPT-4o-mini**, xác thực độ tin cậy và ghi nhận dữ liệu.

```mermaid
flowchart TD
    %% Styling
    classDef start_end fill:#ECEFF1,stroke:#607D8B,stroke-width:2px,color:#37474F,font-weight:bold;
    classDef step fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px,color:#1B5E20;
    classDef ai fill:#EDE7F6,stroke:#651FFF,stroke-width:2px,color:#311B92,font-weight:bold;
    classDef decision fill:#FFFDE7,stroke:#FBC02D,stroke-width:2px,color:#F57F17,font-weight:bold;
    classDef error fill:#FFEBEE,stroke:#C62828,stroke-width:2px,color:#B71C1C;

    %% Nodes
    START([Bắt đầu: Nhận Email / Ảnh biên lai / SMS]):::start_end

    REC_EMAIL[CF Email Routing nhận email thô]:::step
    REC_BOT[Chatbot Telegram nhận ảnh / SMS]:::step

    PARSER[Worker gửi dữ liệu sang OpenAI GPT-4o-mini API]:::ai

    CHECK_JSON{AI bóc tách<br>thành công JSON?}:::decision

    ERR_FORMAT[Ghi log lỗi: Phân tích thất bại]:::error
    MSG_ERR[Bot gửi tin nhắn lỗi: Yêu cầu gửi lại ảnh nét hơn]:::error

    CONF_CHECK{Confidence Score<br>>= 0.85?}:::decision

    SAVE_D1[Worker lưu trực tiếp vào D1 Database<br>Trạng thái: Active / Trial]:::step
    SYNC_SHEETS[Gọi API đồng bộ 2 chiều lên Google Sheets]:::step
    MSG_OK[Bot gửi tin nhắn riêng tư xác nhận lưu thành công]:::step

    LOG_LOW[Lưu parsing_logs trạng thái LOW_CONFIDENCE]:::step
    MSG_CONFIRM[Bot gửi tin nhắn tương tác yêu cầu thành viên xác nhận thủ công]:::step

    USER_RESP{Thành viên bấm nút<br>Xác nhận?}:::decision

    USER_EDIT[Mở Telegram Mini App để thành viên sửa nhanh]:::step

    %% Flow lines
    START --> REC_EMAIL
    START --> REC_BOT

    REC_EMAIL --> PARSER
    REC_BOT --> PARSER

    PARSER --> CHECK_JSON

    CHECK_JSON -- Không --> ERR_FORMAT
    ERR_FORMAT --> MSG_ERR
    MSG_ERR --> END_ERR([Kết thúc lỗi]):::start_end

    CHECK_JSON -- Có --> CONF_CHECK

    CONF_CHECK -- >= 0.85 --> SAVE_D1
    SAVE_D1 --> SYNC_SHEETS
    SYNC_SHEETS --> MSG_OK
    MSG_OK --> END_OK([Kết thúc thành công]):::start_end

    CONF_CHECK -- < 0.85 --> LOG_LOW
    LOG_LOW --> MSG_CONFIRM

    MSG_CONFIRM --> USER_RESP

    USER_RESP -- Đồng ý --> SAVE_D1
    USER_RESP -- Sửa đổi --> USER_EDIT
    USER_EDIT --> SAVE_D1
```

---

#### 2. Lưu Đồ Hệ Thống Cảnh Báo Cộng Tác Đa Tầng (Tiered Escalation Alerts)

Quy trình tự động hóa lập lịch cảnh báo của Subsentry, quét cơ sở dữ liệu định kỳ bằng **Cloudflare Workers Cron Trigger (08:00 AM hàng ngày)** để đưa ra cảnh báo leo thang.

```mermaid
flowchart TD
    %% Styling
    classDef cron fill:#ECEFF1,stroke:#37474F,stroke-width:2px,color:#263238,font-weight:bold;
    classDef step fill:#E1F5FE,stroke:#0288D1,stroke-width:2px,color:#01579B;
    classDef decision fill:#FFFDE7,stroke:#FBC02D,stroke-width:2px,color:#F57F17,font-weight:bold;
    classDef alert_soft fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px,color:#1B5E20;
    classDef alert_red fill:#FFEBEE,stroke:#C62828,stroke-width:2px,color:#B71C1C,font-weight:bold;

    %% Nodes
    CRON[[Hệ thống kích hoạt Cron Trigger - 08:00 AM]]:::cron
    SCAN[Worker quét bảng subscriptions lấy các gói Active / Trial]:::step

    LOOP[Duyệt qua từng gói Subscription]:::step

    CALC_DATE[Tính số ngày còn lại:<br>Next Billing Date - Ngày hiện tại]:::step

    CHECK_T3{Số ngày còn lại<br>bằng 3?}:::decision
    CHECK_T1{Số ngày còn lại<br>bằng 1?}:::decision

    %% T-3 Flow
    GEN_T3[Tạo bản ghi ALERTS trạng thái SOFT_T3 - SCHEDULED]:::alert_soft
    SEND_T3[Bot gửi tin nhắn RIÊNG TƯ cho Subscriber<br>Nút bấm tương tác: Keep / Kill]:::alert_soft

    %% T-1 Flow
    CHECK_REPLIED{Subscriber đã<br>phản hồi Soft Alert?}:::decision
    CHECK_MUST_KEEP{Có phải gói<br>thiết yếu is_must_keep?}:::decision

    GEN_RED[Tạo bản ghi ALERTS trạng thái RED_T24 - SENT]:::alert_red
    SEND_RED[Bot gửi báo động khẩn cấp vào NHÓM CHAT GIA ĐÌNH<br>Tag Subscriber + Card Owner khóa thẻ khẩn cấp]:::alert_red

    IGNORE[Chỉ log báo cáo chi tiêu cuối tháng<br>Bỏ qua Red Alert]:::step

    NEXT[Tiếp tục duyệt gói tiếp theo]:::step
    END_CRON([Kết thúc chu kỳ quét]):::cron

    %% Connections
    CRON --> SCAN
    SCAN --> LOOP
    LOOP --> CALC_DATE

    CALC_DATE --> CHECK_T3

    %% T-3 Branch
    CHECK_T3 -- Đúng --> GEN_T3
    GEN_T3 --> SEND_T3
    SEND_T3 --> NEXT

    %% T-1 Branch
    CHECK_T3 -- Sai --> CHECK_T1
    CHECK_T1 -- Đúng --> CHECK_REPLIED

    CHECK_REPLIED -- Đã phản hồi --> NEXT
    CHECK_REPLIED -- Chưa phản hồi --> CHECK_MUST_KEEP

    CHECK_MUST_KEEP -- Đúng --> IGNORE
    IGNORE --> NEXT

    CHECK_MUST_KEEP -- Sai --> GEN_RED
    GEN_RED --> SEND_RED
    SEND_RED --> NEXT

    CHECK_T1 -- Sai --> NEXT

    NEXT --> LOOP
    LOOP -.->|Duyệt hết danh sách| END_CRON
```
