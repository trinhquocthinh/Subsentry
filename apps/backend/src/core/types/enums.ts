/**
 * Vai trò của thành viên trong gia đình (BR-01, model-erd.md §2.1)
 */
export enum MemberRole {
  ADMIN = 'ADMIN', // Quản trị viên gia đình (Bố/Mẹ)
  SUBSCRIBER = 'SUBSCRIBER', // Thành viên sử dụng dịch vụ
  CARD_OWNER = 'CARD_OWNER', // Chủ thẻ gánh phí
}

/**
 * Trạng thái của gói đăng ký dịch vụ (model-erd.md §2.3)
 */
export enum SubscriptionStatus {
  TRIAL = 'TRIAL', // Đang dùng thử
  ACTIVE = 'ACTIVE', // Đang hoạt động & tính phí
  PENDING_KILL = 'PENDING_KILL', // Đã lên lịch hủy (chờ xác nhận)
  KILLED = 'KILLED', // Đã hủy thành công
}

/**
 * Chu kỳ thanh toán dịch vụ
 */
export enum BillingCycle {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

/**
 * Phân tầng cảnh báo (business-rules.md)
 */
export enum AlertType {
  SOFT_T3 = 'SOFT_T3', // Nhắc nhở nhẹ trước 3 ngày
  RED_T24 = 'RED_T24', // Cảnh báo đỏ trước 24 giờ (có nút Hủy khẩn cấp)
}

/**
 * Trạng thái của tác vụ cảnh báo
 */
export enum AlertStatus {
  SCHEDULED = 'SCHEDULED',
  SENT = 'SENT',
  CANCELLED = 'CANCELLED',
}

/**
 * Phản hồi của người dùng với cảnh báo
 */
export enum AlertResponse {
  PENDING = 'PENDING',
  KEEP = 'KEEP',
  KILL = 'KILL',
}

/**
 * Nguồn dữ liệu hóa đơn/biên lai đầu vào
 */
export enum ParsingLogSource {
  EMAIL = 'EMAIL',
  CHAT_ZALO = 'CHAT_ZALO',
  CHAT_FB = 'CHAT_FB',
}

/**
 * Trạng thái xử lý bóc tách của AI
 */
export enum ParsingLogStatus {
  SUCCESS = 'SUCCESS',
  LOW_CONFIDENCE = 'LOW_CONFIDENCE',
  FAILED = 'FAILED',
}
