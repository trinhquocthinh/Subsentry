# 🛡️ Subsentry — Business Rules (QoL Family Edition)

**Tài Liệu Quy Tắc Nghiệp Vụ - Phiên Bản Gia Đình (Dưới 10 Thành Viên)**
_Vigilant Defense for Your Digital Wallet — Zero-Friction Proactive Defense_

| Metadata             | Details               |
| -------------------- | --------------------- |
| **Document Version** | 1.0                   |
| **Status**           | Approved              |
| **Primary Channels** | Zalo OA, Telegram Bot |

---

### 1. Triết Lý Vận Hành (Core Philosophy)

Dự án **Subsentry (QoL)** vận hành dựa trên nguyên tắc **Hợp tác chủ động (Cooperative Safety Net)**. Mục tiêu không phải là kiểm soát một chiều, mà là xây dựng mạng lưới an toàn giúp bảo vệ dòng tiền của cả gia đình [1, 2], tránh lãng phí do trùng lặp gói dịch vụ, và ngăn chặn triệt để "bẫy dùng thử" [3].
Hệ thống được thiết kế tối giản để chạy trên hạ tầng **Serverless (Cloudflare Workers + D1 Database + Zalo OA/Telegram Bot)** với chi phí vận hành tiệm cận $0 [2].

---

### 2. Quy Tắc Bảo Mật & Quyền Riêng Tư (Privacy & Security Rules)

#### 📌 BR-01: Quyền truy cập dữ liệu tối thiểu (Minimal Data Access)

- **Quy tắc:** Hệ thống tuyệt đối **không** yêu cầu quyền truy cập toàn bộ hòm thư cá nhân hoặc tin nhắn SMS riêng tư của các thành viên gia đình [9].
- **Cơ chế thực thi:**
  - **Email:** Thành viên cấu hình bộ lọc tự động chuyển tiếp (Auto-forward) trên Gmail cá nhân [9]. Chỉ những email từ các Merchant cụ thể (Apple, Google, Netflix...) hoặc chứa từ khóa liên quan (subscription, trial, invoice, đăng ký) mới được chuyển tiếp tới hòm thư chung `subs@yourfamily.com` của Cloudflare Email Routing.
  - **SMS/Biến động số dư:** Thành viên chủ động sao chép tin nhắn hoặc chụp ảnh màn hình biên lai gửi vào **Zalo Bot (Zalo OA)** hoặc **Telegram Bot** chung của gia đình [10].

#### 📌 BR-02: Phân quyền dữ liệu nhóm (Family Data Sharing)

- **Quy tắc:** Mọi thành viên trong gia đình (tối đa 10 người) đều có thể xem danh sách Subscription chung [10, 11] để tránh đăng ký trùng lặp (ví dụ: hai người cùng mua gói Spotify cá nhân).
- **Quy tắc:** Chỉ **Chủ thẻ thanh toán (Card Owner)** và **Người đăng ký (Subscriber)** của gói đó mới có quyền thực hiện lệnh thay đổi trạng thái nhạy cảm (như chuyển dịch vụ sang trạng thái "Killed").

---

### 3. Vòng Đời & Trạng Thái Dịch Vụ (Subscription Lifecycle Rules)

Mỗi dịch vụ đăng ký (Subscription/Trial) được lưu trữ trong Cloudflare D1 Database phải tuân thủ máy trạng thái (State Machine) sau:

#### 📌 BR-03: Định nghĩa trạng thái (State Definitions)

- **Trial (Dùng thử):** Gói đăng ký miễn phí hoặc phí siêu rẻ trong thời gian ngắn (ví dụ: 7 ngày, 30 ngày) [8]. Trạng thái này có độ ưu tiên giám sát cao nhất [2, 5].
- **Active (Đang hoạt động):** Gói đăng ký trả phí định kỳ (Hàng tháng/Hàng năm) được xác nhận là cần thiết [8].
- **Pending Kill (Chờ hủy):** Người dùng đã chọn "Kill" nhưng chưa đến ngày hết hạn hoặc đang đợi thao tác hủy thực tế [8, 10].
- **Killed (Đã hủy):** Dịch vụ đã được xác nhận hủy thành công, không còn rò rỉ tiền tệ [2, 10].

---

### 4. Quy Tắc Cảnh Báo Đa Tầng & Leo Thang (Tiered Alerts & Escalation Rules)

Để bảo vệ dòng tiền hiệu quả mà không gây phiền hà (Alert Fatigue), quy trình nhắc nhở được phân tầng dựa trên thời gian đếm ngược tới ngày gia hạn tiếp theo (Next Billing Date) [8]:

| Mốc thời gian | Loại cảnh báo                 | Đối tượng nhận                            | Kênh nhận                                | Hành động yêu cầu                          |
| ------------- | ----------------------------- | ----------------------------------------- | ---------------------------------------- | ------------------------------------------ |
| **T-3 ngày**  | **Soft Alert** (Nhắc nhở nhẹ) | **Subscriber** (Người đăng ký)            | Zalo OA / Telegram Chat (Private)        | Xác nhận: Keep (Giữ) hoặc Kill (Hủy) [10]  |
| **T-24 giờ**  | **Red Alert** (Báo động đỏ)   | **Subscriber** + **Card Owner** (Chủ thẻ) | Nhóm Chat Gia Đình (Zalo/Telegram Group) | Xác nhận khẩn cấp / Khóa thẻ tạm thời [10] |

#### 📌 BR-04: Quy tắc leo thang Red Alert (Escalation Rule)

- Nếu ở mốc **T-3 ngày (Soft Alert)**, Subscriber chọn **Keep**: Hệ thống cập nhật trạng thái gia hạn tiếp theo và tắt cảnh báo chu kỳ này.
- Nếu ở mốc **T-3 ngày**, Subscriber chọn **Kill**: Hệ thống chuyển trạng thái sang **Pending Kill**, cung cấp Link Hủy trực tiếp [10].
- Nếu Subscriber **không phản hồi** sau 48 giờ (tức là chạm mốc **T-24h**): Hệ thống tự động kích hoạt **Red Alert** gửi thẳng vào nhóm chat chung của gia đình trên Zalo/Telegram, đồng thời tag **Card Owner** (Bố/Mẹ) kèm theo thông tin chi tiết: _"Thẻ [Techcombank - Bố] sắp bị trừ [250,000 VNĐ] cho dịch vụ [Canva] đăng ký bởi [Con]. Vui lòng xác nhận hoặc chủ động khóa thẻ trên app ngân hàng."_

#### 📌 BR-05: Ngoại lệ cho dịch vụ thiết yếu (Must-Keep Exemption)

- Các dịch vụ được gắn nhãn Must-Keep (ví dụ: iCloud 2TB Family, YouTube Premium Family) [9] sẽ **không bao giờ** kích hoạt Red Alert. Các dịch vụ này chỉ gửi thông báo tổng hợp chi phí hàng tháng (Savings & Spend Report) để cả nhà nắm thông tin [10].

---

### 5. Quy Tắc Liên Kết Tài Khoản & Thẻ Thanh Toán (Account & Card Mapping)

#### 📌 BR-06: Bắt buộc định danh chủ thể thanh toán

- Mỗi thực thể Subscription được tạo ra bắt buộc phải liên kết với:
  1. **Subscriber (Zalo User ID hoặc Telegram Chat ID):** Thành viên trực tiếp sử dụng dịch vụ.
  2. **Card Owner (Tên nhãn thẻ):** Người đứng tên thẻ thanh toán thực tế (ví dụ: "Visa Techcombank - Bố").
- **Mục đích:** Đảm bảo khi có sự cố trừ tiền ngoài ý muốn, chủ thẻ có thể nhanh chóng định danh dòng tiền và thực hiện khóa thẻ khẩn cấp trên app ngân hàng nếu cần thiết.

---

### 6. Quy Tắc Bóc Tách Dữ Liệu Tự Động bằng AI (AI Parser Rules via GPT-4o-mini)

#### 📌 BR-07: Xác thực thông tin đầu vào (Parsing Validation)

Khi Cloudflare Worker nhận dữ liệu thô (Email forwarded hoặc ảnh chụp màn hình gửi qua Zalo/Telegram Bot), dữ liệu chuyển qua GPT-4o-mini API phải được bóc tách thành định dạng JSON chuẩn với các quy tắc sau:

1. **Merchant:** Phải được chuẩn hóa tên (ví dụ: NETFLIX.COM -> Netflix, APPLE BILLING -> Apple Services).
2. **Amount:** Tách riêng số tiền và đơn vị tiền tệ (ví dụ: 199000 và VND).
3. **Next Billing Date:** Nếu email/SMS không ghi rõ ngày gia hạn tiếp theo, AI phải tự động tính toán dựa trên ngày nhận hóa đơn + chu kỳ của dịch vụ đó (mặc định là 30 ngày đối với gói tháng và 7 ngày đối với gói dùng thử).
4. **Confidence Score:** AI phải trả về mức độ tự tin từ 0.0 đến 1.0. Nếu score < 0.85, hệ thống không tự động lưu mà gửi tin nhắn yêu cầu Subscriber xác nhận lại thủ công qua Bot [11].

---

### 7. Quy Tắc Đồng Bộ & Dự Phòng (Fallback & Sync Rules)

#### 📌 BR-08: Đồng bộ hai chiều với Google Sheets (Notion là phương án dự phòng tương lai)

- Mặc dù dữ liệu được lưu trữ và vận hành trực tiếp trên Cloudflare D1 Database để đảm bảo tốc độ xử lý của Bot, hệ thống bắt buộc phải có cơ chế **đồng bộ hai chiều (2-way Sync)** với một file **Google Sheets** chung của gia đình [10]. Notion API chỉ được xem xét tích hợp thay thế trong tương lai nếu Google Sheets không còn đáp ứng đủ nhu cầu vận hành.
  - **Chiều đi:** Mọi thay đổi trên D1 (phát hiện gói mới, cập nhật trạng thái Keep/Kill) sẽ được sync lên Google Sheets ngay lập tức.
  - **Chiều về:** Mỗi ngày một lần, Cloudflare Worker quét file Google Sheets để cập nhật lại các cấu hình thủ công do các thành viên sửa trực tiếp trên bảng tính (ví dụ: sửa lại ngày gia hạn hoặc thêm dịch vụ bằng tay) [11].

---

### 8. Quy Tắc Bảo Vệ Dữ Liệu Thẻ Thanh Toán (Card Data Protection Rule)

#### 📌 BR-09: Cấm lưu trữ dữ liệu thẻ nhạy cảm

- Hệ thống **tuyệt đối không** được lưu trữ số thẻ đầy đủ (PAN), mã CVV/CVC, hoặc ngày hết hạn thẻ trong bất kỳ bảng dữ liệu nào của Cloudflare D1.
- Bảng `payment_cards` chỉ được phép lưu `card_label` (nhãn gợi nhớ) và tối đa `last_four` (4 số cuối) để phục vụ mục đích nhận diện, không phục vụ mục đích thanh toán.
- Mọi hành động khóa thẻ hoặc hủy giao dịch thực tế phải được Card Owner tự thực hiện thủ công trên ứng dụng ngân hàng chính chủ; Subsentry không bao giờ có quyền hoặc khả năng kỹ thuật để thao túng thẻ.
