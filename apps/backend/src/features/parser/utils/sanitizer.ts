// apps/backend/src/features/parser/utils/sanitizer.ts

// Task 12.3.1: Giới hạn độ dài nội dung thô trước khi đưa vào prompt OpenAI
const MAX_CONTENT_LENGTH = 8000;

/**
 * Task 3.3.3 / 12.3.1: Lọc bỏ các mẫu Prompt Injection nguy hiểm và giới hạn độ dài
 * nội dung hóa đơn thô trước khi nhúng vào prompt gửi OpenAI.
 *
 * Lưu ý: Đây là blocklist theo regex cho các pattern đã biết (defense-in-depth cơ bản),
 * KHÔNG phải giải pháp chống prompt injection triệt để — kẻ tấn công có thể né bằng cách
 * diễn đạt khác đi (chèn khoảng trắng lạ, unicode homoglyph, ngôn ngữ khác...). Giới hạn
 * độ dài chỉ giảm blast radius (chi phí/khả năng nhồi payload), không ngăn injection tinh vi.
 */
export function sanitizeRawContent(content?: string | null): string {
  if (!content || typeof content !== 'string') {
    return '';
  }

  const truncated =
    content.length > MAX_CONTENT_LENGTH ? content.slice(0, MAX_CONTENT_LENGTH) : content;

  if (truncated.length !== content.length) {
    // eslint-disable-next-line no-console
    console.warn(
      `[SANITIZER] Nội dung bị cắt bớt từ ${content.length} xuống ${MAX_CONTENT_LENGTH} ký tự`
    );
  }

  return (
    truncated
      // Loại bỏ các lệnh cố tình ghi đè hướng dẫn hệ thống
      .replace(/ignore\s+(all\s+)?previous\s+instructions/gi, '[REDACTED_PROMPT_INJECTION]')
      .replace(/disregard\s+above\s+instructions/gi, '[REDACTED_PROMPT_INJECTION]')
      // Loại bỏ các từ khóa giả mạo role
      .replace(/system\s*:/gi, 'System_Filtered:')
      .replace(/you\s+are\s+now\s+a/gi, '[REDACTED_ROLE_CHANGE]')
      // Lọc bỏ thẻ HTML/Script có thể chứa payload độc hại
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .trim()
  );
}
