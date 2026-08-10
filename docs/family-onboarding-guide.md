### 🏡 CHÀO MỪNG CẢ NHÀ ĐẾN VỚI SUBSENTRY!

**Hướng Dẫn Thành Viên Tham Gia Mạng Lưới An Toàn Tài Chính Gia Đình** | _Simple, Privacy-First, For Everyone_

**Document Version:** 1.3 | **Status:** Approved | **Last Updated:** 2026-08-10

Chào mừng cả nhà! **Subsentry** là một dự án nhỏ (Quality of Life) được xây dựng dành riêng cho gia đình chúng ta (khoảng 10 thành viên).

Mục tiêu của Subsentry là **giúp cả nhà không bao giờ bị trừ tiền oan** bởi các ứng dụng dùng thử (như Netflix, Spotify, iCloud, Canva...) quên chưa hủy, đồng thời tối ưu hóa chi tiêu chung của gia đình bằng cách phát hiện các gói đăng ký trùng lặp (ví dụ: hai người cùng mua gói cá nhân thay vì dùng chung gói Family).

---

#### 🌟 1. Subsentry Hoạt Động Như Thế Nào? (Triết Lý Gia Đình)

Hệ thống hoạt động dựa trên nguyên tắc **Hợp tác tự nguyện và Tôn trọng riêng tư tuyệt đối**:

- **Không** cài đặt ứng dụng theo dõi trên điện thoại của bất kỳ ai.
- **Không** đọc trộm tin nhắn SMS cá nhân hay hòm thư email của mọi người.
- Hệ thống chỉ tiếp nhận thông tin khi cả nhà **chủ động gửi ảnh biên lai** vào chat, hoặc cài đặt **script quét hóa đơn chọn lọc ngay trên Gmail cá nhân** (không chuyển tiếp email đi đâu cả, vì gia đình không dùng tên miền riêng).

---

#### 📬 2. Hướng Dẫn Cài Đặt Script Quét Hóa Đơn Trên Gmail (Chỉ Làm 1 Lần Duy Nhất)

Để hệ thống tự động ghi nhận các gói đăng ký dùng thử hoặc hóa đơn mới từ Apple, Google, Netflix... mỗi thành viên chỉ cần cài **Google Apps Script** ngay trên Gmail cá nhân của mình theo các bước sau (script này chạy ngầm 10 phút/lần, chỉ quét email khớp domain nhà cung cấp/từ khóa hóa đơn, hoàn toàn không đụng tới email cá nhân khác — **không cần chuyển tiếp/forward email đi đâu cả**):

- **Bước 1**: Xin Admin cấp cho bạn 2 giá trị: `WORKER_URL` (địa chỉ Worker của gia đình) và `SECRET_TOKEN` (mã bí mật `GMAIL_WEBHOOK_SECRET` dùng chung).
- **Bước 2**: Đăng nhập Gmail trên máy tính cá nhân, mở [script.google.com](https://script.google.com/) ➡️ Bấm **Dự án mới** (New project).
- **Bước 3**: Xóa hết code mẫu, dán toàn bộ nội dung script [`gmail-apps-script.js`](../apps/backend/scripts/gmail-apps-script.js) do Admin cung cấp vào.
- **Bước 4**: Điền đúng `WORKER_URL` và `SECRET_TOKEN` (giá trị nhận ở Bước 1) vào phần **CẤU HÌNH HỆ THỐNG** ở đầu script ➡️ Bấm **Lưu** (💾).
- **Bước 5**: Chọn hàm `setupTrigger` ở menu thả xuống ➡️ Bấm **Chạy** (Run) ➡️ Bấm **Chấp nhận** khi Google hỏi cấp quyền truy cập Gmail.

_Từ nay, script sẽ tự động quét những email chứa hóa đơn hoặc thông báo đăng ký dịch vụ ngay trong hộp thư của bạn và gửi về hệ thống, các email cá nhân khác hoàn toàn được giữ bảo mật 100%!_

---

#### 💬 3. Hướng Dẫn Sử Dụng Chatbot Trên Telegram

##### 🔵 Kết nối lần đầu với Telegram Bot (chỉ làm 1 lần)

- Mở ứng dụng Telegram (tải miễn phí nếu chưa có), tìm kiếm `@SubsentryFamilyBot` (tên chính xác do Admin cung cấp).
- Bấm **Start** để kích hoạt trò chuyện riêng với Bot.
- Admin sẽ thêm bạn vào **Nhóm Gia Đình (Family Group)** trên Telegram để nhận các Báo động đỏ (Red Alert) chung.

Bên cạnh việc chuyển tiếp email tự động, cả nhà có thể trực tiếp gửi thông tin cho Bot gia đình bằng hai cách cực kỳ đơn giản:

##### 📸 Cách 1: Chụp ảnh màn hình biên lai

Khi cả nhà đăng ký thành công một dịch vụ (ví dụ mua Spotify hoặc đăng ký dùng thử Canva), hãy chụp màn hình biên lai xác nhận (có hiển thị tên dịch vụ, số tiền và ngày hết hạn) rồi gửi thẳng bức ảnh đó vào cuộc hội thoại với **Telegram Bot** của gia đình.

##### ✍️ Cách 2: Copy tin nhắn biến động số dư ngân hàng

Nếu thẻ ngân hàng bị trừ tiền, cả nhà chỉ cần sao chép (copy) tin nhắn SMS hoặc tin nhắn biến động số dư từ app ngân hàng (ví dụ: _"Tài khoản xxx bị trừ 250k luc... cho dịch vụ CANVA..."_) rồi paste gửi cho Bot.

_Hệ thống AI thông minh của gia đình sẽ tự động đọc hiểu ảnh chụp/SMS thô để cập nhật thông tin chuẩn xác và lưu lại cho cả nhà cùng theo dõi._

---

#### 🔔 4. Cơ Chế Cảnh Báo Nhắc Nhở Đa Tầng (Yên Tâm Trải Nghiệm)

Để cả nhà không cảm thấy bị phiền phức bởi các thông báo liên tục, Subsentry áp dụng quy trình nhắc nhở chia làm hai tầng rất thông minh:

##### 🟢 Tầng 1: Nhắc nhở nhẹ nhàng riêng tư (Mốc T-3 ngày)

- **Thời điểm**: 3 ngày trước khi gói dùng thử hoặc dịch vụ của bạn tự động gia hạn trừ tiền.
- **Thực thi**: Bot sẽ nhắn tin **riêng tư** cho chính bạn trên Telegram kèm hai nút bấm cực kỳ trực quan:
  - **Keep (Giữ)**: Bạn bấm nút này nếu vẫn muốn tiếp tục sử dụng ứng dụng. Hệ thống sẽ tắt cảnh báo và tiếp tục đếm ngược chu kỳ tiếp theo.
  - **Kill (Hủy)**: Bạn bấm nút này nếu không muốn dùng nữa. Bot sẽ gửi kèm link hướng dẫn chi tiết cách hủy dịch vụ của Apple, Netflix hay Spotify... để bạn tự vào hủy cực nhanh.

##### 🔴 Tầng 2: Báo động đỏ gia đình (Mốc T-24 giờ)

- **Thời điểm**: Chỉ còn 24 giờ trước thời điểm trừ tiền, và **bạn quên phản hồi** tin nhắn nhắc nhở riêng tư ở Tầng 1.
- **Thực thi**: Bot sẽ tự động gửi một thông báo khẩn cấp vào **Nhóm Chat Gia Đình** chung trên Telegram, đồng thời tag tên bạn và **Chủ thẻ thanh toán** (ví dụ: Bố hoặc Mẹ) kèm lời nhắn:
  _"Thẻ [Visa Techcombank - Bố] sắp bị trừ [250,000 VNĐ] cho dịch vụ [Canva] đăng ký bởi [Con]. Con chưa phản hồi xác nhận. Bố/mẹ có muốn chủ động khóa thẻ tạm thời trên app ngân hàng để tránh bị trừ tiền oan không?"_

Cơ chế này giúp bảo vệ tuyệt đối ví tiền của cả gia đình chúng ta, tránh mọi thất thoát tài chính không đáng có một cách hoàn toàn tự động và rảnh tay!
