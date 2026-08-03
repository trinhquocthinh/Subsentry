# 🛡️ Subsentry — Problem Definition (QoL Family Edition)

**Mạng Lưới An Toàn & Quản Lý Gói Dùng Thử Gia Đình** | _Cooperative Safety Net for Your Family's Digital Wallet_

| Metadata             | Details                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| **Document Version** | 1.0                                                                                              |
| **Core Philosophy**  | Cooperative Safety Net (Mạng lưới an toàn cộng tác)                                              |
| **Target Market**    | Family & Micro-Group (< 10 users - Dự án Quality of Life phi thương mại)                         |
| **Tech Stack**       | Cloudflare Workers, Cloudflare D1, Cloudflare Email Routing, Zalo Bot, Telegram Bot, GPT-4o-mini |

---

### 1. Problem Definition (Định Nghĩa Bài Toán)

**Subsentry (QoL Edition)** là hệ thống hỗ trợ gia đình và nhóm nhỏ (dưới 10 thành viên) cộng tác để kiểm soát, tối ưu hóa các dịch vụ đăng ký định kỳ (Subscriptions) và **chấm dứt các khoản phí dùng thử (Free Trial) lãng phí** [1].

Khác với mô hình thương mại giám sát một chiều, phiên bản QoL hoạt động như một **mạng lưới phòng thủ chủ động và cộng tác tự nguyện**, giúp các thành viên bảo vệ dòng tiền chung của gia đình mà không xâm phạm quyền riêng tư cá nhân [2]. Kênh tương tác chính của hệ thống được xây dựng trên **Zalo** (phổ biến nhất tại Việt Nam) và **Telegram Bot** — Telegram được chọn thay Facebook Messenger vì có thể khởi tạo bot tức thì qua `@BotFather`, không cần Business Verification/App Review của Meta.

---

### 2. Problem Statement (Tuyên Bố Vấn Đề)

Việc quản lý các dịch vụ đăng ký (_iCloud, Netflix, Spotify, Canva, SaaS..._) trong một gia đình đông người là gánh nặng lớn về trí nhớ và gây thất thoát tài chính âm thầm [3].

#### 📌 Nguyên nhân chính trong ngữ cảnh gia đình:

- **🪤 Bẫy dùng thử (Free Trial Trap):** Con cái hoặc thành viên đăng ký dùng thử dịch vụ để trải nghiệm, hệ thống tự động trừ tiền sau đó mà không báo trước [3].
- **👥 Trùng lặp lãng phí (Redundancy):** Nhiều thành viên đăng ký các tài khoản cá nhân riêng lẻ (ví dụ: Spotify Individual) thay vì quy tụ về một gói dùng chung (Spotify Family) do thiếu thông tin chéo.
- **🧩 Sự phân mảnh thẻ thanh toán:** Phí đăng ký bị trừ rải rác trên nhiều thẻ ngân hàng của bố, mẹ, anh chị, khiến việc theo dõi và tổng hợp thủ công trở nên bất khả thi [3].
- **🛡️ Rào cản riêng tư:** Các thành viên e ngại khi phải cài đặt ứng dụng đọc toàn bộ tin nhắn SMS hoặc cấp quyền truy cập email cá nhân cho người khác [9].

#### 📉 Hậu quả thực tế:

- Gia đình bị trừ tiền oan cho các dịch vụ không còn sử dụng hoặc bị trùng lặp trong nhiều tháng [4].
- Chủ thẻ (người chi trả chính) luôn ở thế bị động, chỉ phát hiện khi tài khoản đã bị trừ tiền.

---

### 3. Product Objective (Mục Tiêu Sản Phẩm)

> [!TIP]
> **Mục tiêu cốt lõi:** **Loại bỏ hoàn toàn (100%) các khoản phí "oan"** từ việc quên hủy gói dùng thử và **tối ưu hóa 30% chi phí subscription** thông qua việc phát hiện trùng lặp [5].

#### 🎯 Trọng tâm hệ thống QoL:

1. **🔍 Tự động phát hiện (Privacy-First):** Nhận diện gói đăng ký mới qua bộ lọc chuyển tiếp email chọn lọc và qua Chatbot gia đình (**Zalo / Telegram Bot**) [5].
2. **🔔 Cảnh báo cộng tác đa tầng:** Nhắc nhở trực tiếp người đăng ký ở mốc T-3 (Soft Alert). Nếu không phản hồi, hệ thống sẽ báo động chủ thẻ ở mốc T-24h (Red Alert) để khóa thẻ tạm thời nếu cần [5, 10].
3. **💳 Phân định chủ thẻ thanh toán:** Gắn nhãn chi tiết từng gói cước thuộc về thẻ tín dụng của thành viên nào để dễ dàng thực hiện hành động "Kill" (khóa thẻ/hủy dịch vụ) [8, 10].
4. **⚡ Vận hành tối giản (Zero-Ops):** Giao diện chính là **React SPA** (Cloudflare Pages) nhúng trong **Zalo Mini App** và **Telegram Mini App**, kết hợp Chatbot (Zalo/Telegram) để tương tác nhanh gọn; Google Sheets đóng vai trò dashboard cấu hình dự phòng cho thành viên lớn tuổi (Notion là phương án dự phòng tương lai nếu Google Sheets không đáp ứng đủ nhu cầu), chi phí vận hành tiệm cận $0.

---

### 4. Primary Users and Context (Đối Tượng & Ngữ Cảnh)

- **👤 Chủ Thẻ (Card Owner/Creator):** Người sở hữu thẻ thanh toán chính trong nhà (ví dụ: Bố, Mẹ). Họ cần biết thẻ của mình đang liên kết với những dịch vụ nào để chủ động quản lý dòng tiền [6].
- **👥 Thành Viên Đăng Ký (Subscriber/Participant):** Con cái hoặc người thân trực tiếp trải nghiệm dịch vụ. Họ tự chịu trách nhiệm đưa ra quyết định "Keep" hoặc "Kill" khi nhận cảnh báo [6].

---

### 5. Core Domain Concept (Khái Niệm Miền Cốt Lõi)

#### 💳 Subscription / Trial Entity (Thực thể trung tâm) [8]

- **Nhà cung cấp (Merchant):** Tên dịch vụ (Netflix, Spotify, Canva...) [8].
- **Người đăng ký (Subscriber):** Thành viên trong nhà tạo tài khoản (Xác định bằng Zalo User ID hoặc Telegram Chat ID).
- **Chủ thẻ thanh toán (Card Owner):** Người chịu chi phí (Ví dụ: Thẻ Techcombank - Bố).
- **Ngày gia hạn (Next Billing Date):** Mốc đếm ước tính trừ tiền [8].
- **Số tiền (Amount):** Số tiền thanh toán định kỳ [8].
- **Trạng thái (Status):** Active | Trial | Pending Kill [8].

---

### 6. Inputs (Dữ Liệu Đầu Vào)

#### 6.1 Privacy-First Inputs [9]

- **Cloudflare Email Routing:** Các thành viên thiết lập bộ lọc tự động chuyển tiếp (auto-forward) trên Gmail cá nhân. Chỉ những email chứa từ khóa (_"subscription"_, _"trial"_, _"invoice"_, _"đăng ký"_) mới được chuyển về hòm thư chung `subs@yourfamily.com` [9].
- **Interactive Chatbot (Zalo / Telegram):** Thành viên forward tin nhắn biến động số dư ngân hàng hoặc chụp ảnh màn hình biên lai đăng ký gửi vào Zalo Bot hoặc Telegram Bot chung của gia đình [9].

#### 6.2 AI Processing

- **GPT-4o-mini API:** Đọc hiểu nội dung email thô hoặc ảnh chụp biên lai, bóc tách cấu trúc dữ liệu sạch (Merchant, Amount, Next Billing Date, Subscriber) mà không cần cấu hình parser cứng nhắc cho từng nhà cung cấp [14].

---

### 7. Outputs (Dữ Liệu Đầu Đầu Ra)

| Output Component                                               | Chi tiết tính năng (QoL Edition)                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 📊 **React SPA Dashboard (Zalo Mini App / Telegram Mini App)** | Giao diện quản lý chính của gia đình, hiển thị trực quan danh sách subscription, ngày gia hạn, số tiền và tổng chi phí hàng tháng [10].                                                                                                                                                                                                             |
| 📊 **Google Sheets Dashboard (dự phòng)**                      | Kênh cấu hình thay thế cho thành viên lớn tuổi; đồng bộ 2 chiều với Cloudflare D1. Notion là phương án dự phòng tương lai nếu cần thay thế Google Sheets [10].                                                                                                                                                                                      |
| 🔔 **Cooperative Tiered Alerts**                               | • **Soft Alert (T-3 days):** Bot gửi tin nhắn riêng qua Zalo OA/Telegram nhắc nhở thành viên đã đăng ký gói dịch vụ [10].<br>• **Red Alert (T-24 hours):** Nếu thành viên chưa bấm xác nhận "Keep", Bot sẽ gửi cảnh báo khẩn cấp vào nhóm chat gia đình (Zalo Group / Telegram Group) và tag Chủ Thẻ để chuẩn bị phương án khóa thẻ ngân hàng [10]. |
| 🛡️ **Direct Kill Link**                                        | Bot cung cấp link trực tiếp dẫn đến trang hủy dịch vụ của các app phổ biến nhất của gia đình (iCloud, Spotify, Netflix...) [10].                                                                                                                                                                                                                    |

---

### 8. Technical Architecture & Cost (Kiến Trúc & Chi Phí)

Dự án được triển khai trên nền tảng Serverless của **Cloudflare** và **OpenAI** để đảm bảo tính ổn định tuyệt đối và chi phí vận hành tiệm cận bằng $0:

- **Backend (Cloudflare Workers):** Xử lý webhook từ Zalo OA Webhook và Telegram Bot API Webhook, kết hợp Cloudflare Email Routing. Miễn phí 100,000 requests/ngày.
- **Database (Cloudflare D1):** Lưu trữ thông tin Subscription/Trial dạng SQLite ngay trên Edge. Miễn phí 5,000,000 lượt đọc và 100,000 lượt ghi mỗi ngày.
- **LLM Engine (GPT-4o-mini via API):** Gọi trực tiếp từ Việt Nam không qua VPN. Chi phí cực kỳ rẻ (~$0.15/1M tokens đầu vào), tổng chi phí sử dụng thực tế cho cả gia đình < $1/tháng.

> ⚠️ _Lưu ý: Các hạn mức Free Tier nêu trên áp dụng tại thời điểm biên soạn tài liệu và có thể thay đổi theo chính sách của Cloudflare. Cần xác minh lại trên trang pricing chính thức của Cloudflare tại thời điểm triển khai thực tế._

---

### 9. Scope of Implementation (Phạm Vi Triển Khai)

#### ✅ Trong phạm vi (In Scope):

- Vận hành nội bộ dưới 10 người dùng gia đình [11].
- Tích hợp Cloudflare Email Routing để nhận diện email hóa đơn tự động [11].
- **Zalo / Telegram Bot** tiếp nhận ảnh chụp biên lai và tin nhắn chuyển tiếp [11].
- Triển khai giao diện quản trị **React SPA** (Cloudflare Pages) nhúng trong Zalo Mini App và Telegram Mini App.
- Lưu trữ cơ sở dữ liệu trên Cloudflare D1 và đồng bộ lên Google Sheets (Notion là phương án dự phòng tương lai nếu Google Sheets không đáp ứng đủ nhu cầu).
- Gửi thông báo đa tầng T-3 (Soft Alert đến người đăng ký qua Zalo/Telegram private chat) và T-24h (Red Alert đến chủ thẻ qua nhóm chat chung) [11].

#### ❌ Ngoài phạm vi (Out of Scope):

- Tự động click hủy dịch vụ trên trang web bên thứ ba (Browser Automation) [12].
- Đàm phán giảm giá gói cước [12].
- Tích hợp cổng thanh toán thương mại hoặc quản lý hóa đơn doanh nghiệp [12].
- Cài đặt ứng dụng đọc SMS toàn quyền trên điện thoại thành viên (tránh xâm hại riêng tư).
