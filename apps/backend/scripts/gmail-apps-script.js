/* eslint-disable */
/**
 * ==============================================================================
 * SUBSENTRY — GOOGLE APPS SCRIPT AUTOMATIC GMAIL FORWARDER (0đ / NO DOMAIN)
 * ==============================================================================
 *
 * Script này tự động quét các email hóa đơn / đăng ký dùng thử từ Gmail cá nhân
 * và gửi HTTP POST về Cloudflare Worker của Subsentry hoàn toàn tự động.
 *
 * ------------------------------------------------------------------------------
 * HƯỚNG DẪN CÀI ĐẶT TRONG 2 PHÚT:
 * ------------------------------------------------------------------------------
 * 1. Truy cập https://script.google.com/ và bấm "Dự án mới" (New project).
 * 2. Xóa hết mã cũ và DÁN TOÀN BỘ CODE NÀY VÀO.
 * 3. Điền WORKER_URL và SECRET_TOKEN của bạn ở phần CẤU HÌNH bên dưới.
 * 4. Bấm "Lưu" (Biểu tượng đĩa mềm 💾).
 * 5. Chạy thử hàm `setupTrigger` một lần duy nhất để bật lịch tự động 10 phút/lần:
 *    - Chọn hàm `setupTrigger` ở menu chọn hàm trên cùng.
 *    - Bấm "Chạy" (Run) -> Đồng ý cấp quyền truy cập Gmail khi Google hỏi.
 *
 * Xong! Từ nay mỗi khi có email hóa đơn, script sẽ tự động gửi về Subsentry Worker.
 * ==============================================================================
 */

// ==================== CẤU HÌNH HỆ THỐNG ====================
// URL Backend Cloudflare Worker của bạn
const WORKER_URL = 'https://subsentry-backend.<subdomain>.workers.dev/webhook/email';

// Token bí mật để bảo vệ Webhook (khớp với secret GMAIL_WEBHOOK_SECRET trên Worker)
const SECRET_TOKEN = 'your-secret-key-here';

// Nhãn (Label) dùng để đánh dấu các email đã được gửi đi (tránh gửi trùng)
const PROCESSED_LABEL_NAME = 'Subsentry_Processed';
// ============================================================

function processBillingEmails() {
  const label = getOrCreateLabel(PROCESSED_LABEL_NAME);

  // Review Point E: Thu hẹp query tìm kiếm kết hợp merchant domain + từ khóa chủ đề
  const searchQuery =
    '(from:(apple.com OR google.com OR netflix.com OR spotify.com OR canva.com OR youtube.com OR adobe.com OR microsoft.com OR amazon.com OR patreon.com OR openai.com OR chatgpt.com) OR subject:(invoice OR receipt OR "đăng ký" OR "hóa đơn" OR "biên lai")) -label:' +
    PROCESSED_LABEL_NAME;
  const threads = GmailApp.search(searchQuery, 0, 10);

  Logger.log('Tìm thấy ' + threads.length + ' luồng email mới cần xử lý.');

  threads.forEach(function (thread) {
    const messages = thread.getMessages();
    let allSucceeded = true;

    messages.forEach(function (message) {
      const from = message.getFrom();
      const to = message.getTo();
      const subject = message.getSubject();
      const text = message.getPlainBody();
      const html = message.getBody();
      const date = message.getDate().toISOString();

      const payload = {
        secret: SECRET_TOKEN,
        from: from,
        to: to,
        subject: subject,
        text: text,
        html: html,
        date: date,
      };

      const options = {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'X-Gmail-Webhook-Secret': SECRET_TOKEN,
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      };

      try {
        const response = UrlFetchApp.fetch(WORKER_URL, options);
        if (response.getResponseCode() >= 300) {
          allSucceeded = false;
          Logger.log(
            'Lỗi webhook HTTP ' + response.getResponseCode() + " với email: '" + subject + "'"
          );
        } else {
          Logger.log("Đã gửi email: '" + subject + "' | Response: " + response.getContentText());
        }
      } catch (e) {
        allSucceeded = false;
        Logger.log('Lỗi gửi webhook: ' + e.toString());
      }
    });

    // Review Point F (Fixed): Đánh dấu nhãn sau khi đã gửi thành công toàn bộ tin nhắn trong thread để tránh mất dữ liệu âm thầm
    if (allSucceeded) {
      thread.addLabel(label);
    }
  });
}

function getOrCreateLabel(name) {
  let label = GmailApp.getUserLabelByName(name);
  if (!label) {
    label = GmailApp.createLabel(name);
  }
  return label;
}

/**
 * Hàm cài đặt lịch tự động chạy ngầm 10 phút / lần.
 * Bạn chỉ cần chọn hàm này và bấm "Run" (Chạy) 1 lần duy nhất!
 */
function setupTrigger() {
  // Xóa các trigger cũ nếu có
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'processBillingEmails') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Tạo trigger mới chạy 10 phút/lần
  ScriptApp.newTrigger('processBillingEmails').timeBased().everyMinutes(10).create();

  Logger.log('✅ Đã cài đặt lịch chạy tự động ngầm 10 phút/lần thành công!');
}
