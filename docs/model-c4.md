### 🌐 C4 ARCHITECTURE MODEL — Subsentry

**Sơ Đồ Kiến Trúc Hệ Thống Theo Mô Hình C4 (C1 Context & C2 Container)** | _Enterprise-Grade System Design for Quality-of-Life Family Project_
**Document Version:** 1.0 | **Status:** Approved
---

#### 1. C1 - Sơ Đồ Ngữ Cảnh Hệ Thống (System Context Diagram)

Mức C1 mô tả ranh giới hệ thống, các tác nhân bên ngoài (Thành viên gia đình, Chủ thẻ) và các hệ thống bên thứ ba tích hợp với **Subsentry**.

```mermaid
graph TB
    %% Styling
    classDef actor fill:#E1F5FE,stroke:#0288D1,stroke-width:2px,color:#01579B,font-weight:bold;
    classDef system fill:#E8F5E9,stroke:#388E3C,stroke-width:2px,color:#1B5E20,font-weight:bold;
    classDef extSystem fill:#ECEFF1,stroke:#607D8B,stroke-width:2px,color:#263238,font-weight:bold;

    %% Actors
    SUB[Subscriber<br>Con cái / Thành viên]:::actor
    OWNER[Card Owner<br>Bố / Mẹ / Chủ thẻ]:::actor

    %% Subsentry Boundary
    subgraph Subsentry_System [Hệ Thống Giám Sát Subsentry]
        SYS[Subsentry App]:::system
    end

    %% External Systems
    MERCHANT[Dịch vụ bên thứ ba<br>Netflix, Spotify, Apple...]:::extSystem
    ZALO_TG[Mạng xã hội<br>Zalo OA & Telegram Bot]:::extSystem
    EMAIL_SRV[Hệ thống Email<br>Gmail cá nhân thành viên]:::extSystem

    %% Interactions
    SUB -->|1. Đăng ký & Sử dụng| MERCHANT
    MERCHANT -->|2. Trừ tiền qua thẻ| OWNER
    MERCHANT -->|3. Gửi biên lai/Hóa đơn| EMAIL_SRV

    EMAIL_SRV -->|4. Tự động chuyển tiếp| SYS
    SUB -->|5. Chụp hóa đơn / gửi SMS| ZALO_TG
    ZALO_TG -->|6. Đẩy tin nhắn Webhook| SYS

    SYS -->|7. Gửi cảnh báo đa tầng| ZALO_TG
    ZALO_TG -->|8. Nhắc nhở riêng tư| SUB
    ZALO_TG -->|9. Báo động khẩn cấp| OWNER
```

---

#### 2. C2 - Sơ Đồ Thành Phần Hệ Thống (Container Diagram)

Mức C2 đi sâu vào bên trong ranh giới của **Subsentry System**, mô tả các container logic (Frontend, Backend, Database) chạy trên môi trường **Serverless Cloudflare** và cách chúng tương tác qua lại.

```mermaid
graph TB
    %% Styling
    classDef user fill:#E1F5FE,stroke:#0288D1,stroke-width:2px,color:#01579B;
    classDef container fill:#FFF3E0,stroke:#F57C00,stroke-width:2px,color:#E65100,font-weight:bold;
    classDef db fill:#EDE7F6,stroke:#5E35B1,stroke-width:2px,color:#4A148C,font-weight:bold;
    classDef external fill:#ECEFF1,stroke:#607D8B,stroke-width:2px,color:#263238;

    %% Actors
    SUB[Subscriber<br>Thành viên gia đình]:::user
    OWNER[Card Owner<br>Chủ thẻ thanh toán]:::user

    subgraph Cloudflare_Platform [Hạ Tầng Cloudflare Serverless]

        %% Frontend Containers
        ZMA[Zalo Mini App<br>React SPA]:::container
        TGA[Telegram Mini App<br>React SPA]:::container
        CF_PAGES[Cloudflare Pages<br>Static Hosting & CDN]:::container

        %% Mail Router
        MAIL_ROUT[Cloudflare Email Routing<br>Mail Receiver]:::container

        %% Backend API Worker
        WORKER[Cloudflare Workers<br>Hono Framework Backend]:::container

        %% Database
        D1_DB[(Cloudflare D1<br>SQLite Database)]:::db
    end

    %% Third-Party Services
    OPENAI[OpenAI API<br>GPT-4o-mini Parser]:::external
    SHEETS[Google Sheets API<br>Bảng tính dự phòng]:::external
    ZALO_API[Zalo OA API]:::external
    TG_API[Telegram Bot API]:::external

    %% Frontend Deploy Connection
    CF_PAGES -.->|Phục vụ Static Files| ZMA
    CF_PAGES -.->|Phục vụ Static Files| TGA

    %% Input Flows
    SUB -->|1. Forward Email Hóa Đơn| MAIL_ROUT
    SUB -->|2. Gửi ảnh/SMS qua chat| ZALO_API
    SUB -->|2. Gửi ảnh/SMS qua chat| TG_API

    MAIL_ROUT -->|3. Route Email dữ liệu thô| WORKER
    ZALO_API -->|4. Webhook Event| WORKER
    TG_API -->|4. Webhook Event| WORKER

    %% Worker Internal Processing & DB
    WORKER -->|5. Lưu trữ & Truy vấn dữ liệu| D1_DB
    WORKER -->|6. Phân tích ngữ nghĩa ảnh/SMS| OPENAI
    WORKER -->|7. Đồng bộ dữ liệu định kỳ| SHEETS

    %% Interactive Dashboard flows
    SUB -->|8. Quản lý trực quan| ZMA
    OWNER -->|8. Xem danh sách / Thêm thẻ| TGA
    ZMA -->|9. Gọi API HTTP POST/GET| WORKER
    TGA -->|9. Gọi API HTTP POST/GET| WORKER

    %% Notifications out
    WORKER -->|10. Gửi tin nhắn / Nút bấm| ZALO_API
    WORKER -->|10. Gửi tin nhắn / Nút bấm| TG_API
    ZALO_API -->|11. Nhắc nhở| SUB
    TG_API -->|11. Báo động nhóm| OWNER
```

---

#### 3. Mô Tả Chi Tiết Nhiệm Vụ Các Container (Container Specifications)

##### 3.1 Frontend: Zalo Mini App / Telegram Mini App (React SPA)

- **Công nghệ:** React v18.3.x, TypeScript, Tailwind CSS, Vite v5.x.
- **Lưu trữ (Hosting):** Cloudflare Pages (Serverless Hosting).
- **Mô tả nhiệm vụ:**
  - Cung cấp giao diện Dashboard tối giản, hiển thị trực quan biểu đồ hình tròn phân phối chi tiêu, danh sách các gói đăng ký đang hoạt động, danh sách thẻ thanh toán và đồng hồ đếm ngược ngày gia hạn (`Next Billing Date`).
  - Cung cấp giao diện tương tác cho phép cấu hình nhanh: Gán chủ thẻ, chỉnh sửa số tiền, đổi ngày gia hạn thủ công mà không cần dùng câu lệnh chat.
  - Tích hợp sâu thông qua Zalo SDK (Zalo Mini App) và Telegram Web App SDK (`window.Telegram.WebApp`) để lấy thông tin `User ID` tự động mà không bắt người dùng đăng nhập lại.

##### 3.2 Backend: Cloudflare Workers (Hono API)

- **Công nghệ:** TypeScript, Hono Framework v4.5.x, Drizzle ORM v0.32.x.
- **Mô tả nhiệm vụ:**
  - Làm xương sống xử lý toàn bộ logic nghiệp vụ (Core Domain Logic).
  - Cung cấp các cổng API (Endpoints) tiếp nhận Webhook từ Zalo OA, Telegram Bot và hệ thống Mail.
  - Thực hiện cơ chế kiểm soát chất lượng dữ liệu: Đọc dữ liệu, gọi API OpenAI GPT-4o-mini để bóc tách hóa đơn, kiểm tra ngưỡng tin cậy (`Confidence Score >= 0.85`), xử lý ghi nhận D1 Database.
  - Vận hành bộ lập lịch (Cron Triggers) để quét D1 hàng ngày lúc 08:00 sáng, tự động tính toán thời gian `T-3` và `T-24h` để gửi tin nhắn cảnh báo đa tầng tới đúng thành viên gia đình.

##### 3.3 Database: Cloudflare D1 (SQLite)

- **Công nghệ:** Cloudflare D1 Native SQLite engine.
- **Mô tả nhiệm vụ:**
  - Lưu trữ dữ liệu có cấu trúc ổn định của 10 thành viên gia đình, thẻ tín dụng, lịch sử cảnh báo và nhật ký xử lý dữ liệu của AI.
  - Hỗ trợ cơ chế giao dịch (Transactions) để đảm bảo dữ liệu ghi nhận đồng bộ, không bị xung đột khi nhiều webhook đẩy về cùng một lúc.

##### 3.4 Email Receiver: Cloudflare Email Routing

- **Công nghệ:** Cloudflare Mail Routing Engine.
- **Mô tả nhiệm vụ:**
  - Làm phễu đón nhận các thư điện tử chuyển tiếp từ Gmail cá nhân của 10 thành viên gia đình gửi về địa chỉ tập trung `subs@yourfamily.com`.
  - Mã hóa và chuyển tiếp (forward) toàn bộ tiêu đề (Subject), nội dung văn bản (Body Text/HTML) của email dưới dạng payload HTTP POST sang cho Cloudflare Workers xử lý, tránh việc phải dựng một máy chủ nhận Mail (IMAP/SMTP) tốn chi phí.

##### 3.5 Ghi chú mở rộng tương lai: Notion API (Tùy chọn)

Notion API **không** nằm trong kiến trúc container hiện tại ở sơ đồ C2. Đây là phương án dự phòng được cân nhắc tích hợp trong tương lai nếu Google Sheets API không còn đáp ứng đủ nhu cầu vận hành (ví dụ giới hạn quota, thiếu tính năng). Khi triển khai, Notion sẽ được tích hợp như một container thay thế tương đương `SHEETS`, không ảnh hưởng tới các thành phần còn lại của hệ thống.
