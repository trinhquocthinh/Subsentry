# 🛡️ PRODUCT REQUIREMENTS DOCUMENT (PRD) — Subsentry

**Mạng Lưới An Toàn & Quản Lý Gói Dùng Thử Gia Đình** | _Cooperative Safety Net for Your Family's Digital Wallet_

| Document Metadata    | Details                                       |
| -------------------- | --------------------------------------------- |
| **Document Version** | 1.0                                           |
| **Target Audience**  | Family & Micro-Group (< 10 Users)             |
| **Primary Channels** | Zalo OA, Facebook Messenger, Cloudflare Email |
| **Status**           | Approved                                      |

---

## 1. Executive Summary & Objective

**Subsentry** là một dự án phi thương mại, tập trung nâng cao chất lượng cuộc sống (Quality of Life - QoL) cho gia đình (quy mô khoảng 10 người) bằng cách loại bỏ triệt để các khoản phí trừ tiền oan từ bẫy dùng thử (Free Trial Trap) và tối ưu hóa chi tiêu các dịch vụ đăng ký chung [1, 2].

### 🎯 Mục tiêu sản phẩm (Product Objectives):

1. **Loại bỏ 100%** các khoản phí "quên hủy" từ các gói dùng thử (Free Trial) [5].
2. **Tối ưu hóa ít nhất 30%** chi phí đăng ký định kỳ thông qua việc phát hiện các gói cước trùng lặp (ví dụ: các thành viên dùng riêng lẻ thay vì dùng chung gói Family) [5]. Tỷ lệ tiết kiệm được đo bằng công thức: _(Tổng chi phí các gói cá nhân trùng lặp phát hiện được − Chi phí gói Family tương đương) / Tổng chi phí subscription hiện tại_, và được tổng hợp trong Spend Report hàng tháng (xem mục 3.4).
3. **Bảo vệ quyền riêng tư tuyệt đối** của các thành viên gia đình (không cài app giám sát, không đọc trộm tin nhắn/email cá nhân) [9].
4. **Vận hành rảnh tay (Zero-Ops) và chi phí tiệm cận $0** bằng cách tận dụng tối đa hệ sinh thái serverless và tài khoản thử nghiệm của các nền tảng chat [2].

---

## 2. User Personas (Chân Dung Người Dùng)

Hệ thống Subsentry chia người dùng thành hai vai trò cốt lõi trong gia đình:

### 👤 2.1 Chủ Thẻ Thanh Toán (Card Owner)

- **Mô tả:** Thường là bố, mẹ hoặc người chi trả chính trong nhà. Họ đứng tên các thẻ tín dụng/thẻ ghi nợ dùng để liên kết thanh toán cho các dịch vụ đăng ký.
- **Nỗi đau (Pain Points):**
  - Luôn ở thế bị động khi thẻ bị trừ tiền mà không biết ai trong nhà đã đăng ký và đăng ký cái gì.
  - Ngại phải đi hỏi từng người mỗi khi thấy biến động số dư ngân hàng lạ.
- **Nhu cầu:** Biết chính xác thẻ của mình đang gánh những dịch vụ nào và có khả năng ngăn chặn khẩn cấp (khóa thẻ tạm thời) nếu có khoản trừ tiền bất hợp lý.

### 👥 2.2 Thành Viên Đăng Ký (Subscriber / Participant)

- **Mô tả:** Con cái hoặc các thành viên khác sử dụng dịch vụ trực tiếp. Họ là người chủ động đăng ký tài khoản (Netflix, Spotify, Canva, OpenAI...) và liên kết thẻ của Card Owner để dùng thử hoặc mua gói.
- **Nỗi đau (Pain Points):**
  - Thường xuyên quên mốc thời gian hết hạn dùng thử (thường là 7 ngày hoặc 30 ngày) dẫn đến việc thẻ của bố mẹ bị tự động gia hạn trừ tiền oan [3].
  - E ngại việc chia sẻ toàn quyền hòm thư cá nhân hoặc tin nhắn riêng tư để cài app theo dõi [9].
- **Nhu cầu:** Được nhắc nhở nhẹ nhàng trước khi gói dùng thử hết hạn để kịp thời quyết định "Keep" (Giữ và trả phí) hoặc "Kill" (Hủy gói).

---

## 3. Functional Requirements (Yêu Cầu Chức Năng)

### 📥 3.1 Luồng Thu Thập Dữ Liệu Đầu Vào (Privacy-First Inputs)

Hệ thống thu thập thông tin Subscription một cách tự động và bán tự động mà không cần can thiệp sâu vào thiết bị cá nhân:

#### 📬 3.1.1 Tự động hóa qua Email (Cloudflare Email Routing)

- **Tính năng:** Tự động bắt biên lai thanh toán hoặc email xác nhận đăng ký dùng thử.
- **Cơ chế:**
  1. Các thành viên chỉ cần tạo một luật chuyển tiếp tự động (Auto-forward Filter) trên Gmail cá nhân.
  2. Luật này chỉ chuyển tiếp các thư chứa từ khóa nhạy cảm (_"trial"_, _"subscription"_, _"invoice"_, _"đăng ký"_, _"hóa đơn"_) gửi từ các tên miền merchant (như Apple, Google, Netflix, Spotify, Canva) về địa chỉ email chung của gia đình: `subs@yourfamily.com` [9].
  3. Cloudflare Email Routing tiếp nhận và kích hoạt Cloudflare Worker để xử lý nội dung.

#### 💬 3.1.2 Bán tự động qua Chatbot (Zalo / Messenger Bot)

- **Tính năng:** Cho phép thành viên chủ động gửi dữ liệu giao dịch cho Bot.
- **Cơ chế:**
  - Thành viên copy-paste nội dung SMS biến động số dư ngân hàng gửi thẳng vào chat riêng với Bot [10].
  - Thành viên chụp ảnh màn hình hóa đơn/biên lai giao dịch và gửi trực tiếp cho Bot [10].

---

### 🧠 3.2 Luồng Xử Lý Trí Tuệ Nhân Tạo (AI Parser Engine)

- **Công nghệ:** Sử dụng **OpenAI API GPT-4o-mini** để đọc hiểu email thô hoặc bóc tách ảnh chụp màn hình (OCR).
- **Đầu ra chuẩn hóa:** Trả về dữ liệu JSON có cấu trúc gồm: `Merchant` (chuẩn hóa tên), `Amount` (số tiền), `Currency` (loại tiền tệ), `Next Billing Date` (ngày gia hạn kế tiếp), `Confidence Score` (độ tự tin của mô hình) [9].
- **Xử lý ngoại lệ:** Nếu độ tự tin của AI dưới `0.85`, Bot sẽ gửi tin nhắn phản hồi hỏi lại thành viên để xác nhận thông tin trước khi ghi nhận vào cơ sở dữ liệu [9].

---

### 🔔 3.3 Hệ Thống Cảnh Báo Cộng Tác Đa Tầng (Tiered Escapes & Alerts)

Để tránh hiện tượng trơ cảnh báo (Alert Fatigue), hệ thống phân tách quy trình nhắc nhở thành hai tầng nghiêm ngặt:

#### 🟢 Tầng 1: Soft Alert (Mốc T-3 Ngày)

- **Kịch bản:** 3 ngày trước khi dịch vụ hết hạn dùng thử hoặc gia hạn tiếp theo [8].
- **Thực thi:** Bot gửi tin nhắn **riêng tư (Private)** qua Zalo hoặc Messenger tới chính **Subscriber** đăng ký gói đó [10].
- **Yêu cầu hành động:** Cung cấp hai nút tương tác nhanh:
  - **Keep (Giữ):** Xác nhận tiếp tục dùng, hệ thống cập nhật chu kỳ thanh toán tiếp theo và dừng cảnh báo cho chu kỳ này.
  - **Kill (Hủy):** Chuyển dịch vụ sang trạng thái `Pending Kill` và gửi kèm link hướng dẫn hủy trực tiếp [10].

#### 🔴 Tầng 2: Red Alert (Mốc T-24 Giờ)

- **Kịch bản:** Khi dịch vụ chỉ còn 24 giờ trước thời điểm trừ tiền, và **Subscriber không phản hồi** gì sau 48 giờ kể từ Soft Alert [6].
- **Thực thi:** Bot tự động gửi tin nhắn báo động khẩn cấp vào **Nhóm Chat Gia Đình (Zalo Group hoặc Messenger Group)** [10].
- **Nội dung:** Tag trực tiếp **Card Owner** (Chủ thẻ) và **Subscriber** (Thành viên đăng ký) để hai bên nắm thông tin thực hiện khóa thẻ tạm thời trên ứng dụng ngân hàng hoặc hủy khẩn cấp dịch vụ trước khi bị trừ tiền [10].

---

### 📊 3.4 Giao Diện Quản Trị Gia Đình (Family Dashboard)

- **Giải pháp:** Giao diện quản trị chính là **React SPA** triển khai trên **Cloudflare Pages**, nhúng trực tiếp vào **Zalo Mini App** và **Messenger Webview** để thành viên xem danh sách subscription, gán chủ thẻ, và bấm Keep/Kill ngay trong app chat quen thuộc mà không cần đăng nhập lại [10]. **Google Sheets API** đóng vai trò dashboard cấu hình dự phòng dành cho thành viên lớn tuổi ít quen thao tác app; **Notion API** chỉ được cân nhắc tích hợp trong tương lai nếu Google Sheets không còn đáp ứng đủ nhu cầu vận hành.
- **Tính năng:**
  - Đồng bộ 2 chiều (2-way Sync): Mọi biến động do Bot/SPA ghi nhận trên Cloudflare D1 sẽ tự động đẩy lên Google Sheets [10].
  - Cấu hình thủ công: Thành viên lớn tuổi có thể lên Google Sheets sửa ngày gia hạn, sửa số tiền, hoặc thêm các dịch vụ thanh toán tiền mặt bằng tay [11]. Cloudflare Worker định kỳ quét file mỗi ngày một lần để đồng bộ ngược lại Database D1 [10].
  - Báo cáo Spend Report: Tự động tổng hợp chi phí đăng ký hằng tháng của cả gia đình kèm % tiết kiệm ước tính, gửi vào nhóm chat vào ngày cuối tháng [10].

---

## 4. Non-Functional Requirements (Yêu Cầu Phi Chức Năng)

### 🔒 4.1 Bảo Mật & Riêng Tư (Security & Privacy)

- **Zero-Permission:** Tuyệt đối không yêu cầu quyền root máy, không cài app đọc trộm SMS hay can thiệp sâu vào thiết bị của các thành viên [9].
- **Data Isolation & Chia sẻ dữ liệu có kiểm soát:** Dữ liệu gia đình lưu trữ chính trong cơ sở dữ liệu Cloudflare D1 thuộc tài khoản cá nhân của bạn. Nội dung biên lai/hóa đơn chỉ được gửi tới **OpenAI API** (bóc tách dữ liệu) và **Google Sheets API** (đồng bộ dashboard dự phòng) với vai trò bên xử lý được ủy quyền phục vụ đúng mục đích vận hành; dữ liệu không được bán hoặc chia sẻ cho bất kỳ bên thứ ba nào khác ngoài các nhà cung cấp dịch vụ nêu trên.
- **API Secret Management:** Tất cả các API Key (OpenAI, Zalo OA Token, Messenger Token) phải được mã hóa và lưu trữ an toàn trong biến môi trường của Cloudflare Workers.

### 💸 4.2 Chi Phí Vận Hành (Operating Cost)

- Vận hành hệ thống ở quy mô 10 người phải nằm hoàn toàn trong gói miễn phí (Free Tier) của Cloudflare (Workers, Pages, D1, Email Routing).
- Tổng ngân sách trả phí cho API OpenAI (GPT-4o-mini) phải dưới **$1.00 USD / tháng**.

---

## 5. Exclusions (Phạm Vi Loại Trừ)

- Hệ thống không hỗ trợ tự động hủy dịch vụ (không tự động click hủy trên Apple, Netflix...) do hạn chế bảo mật của bên thứ ba [12].
- Hệ thống không tích hợp cổng thanh toán trực tuyến.
