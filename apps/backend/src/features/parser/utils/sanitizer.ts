// apps/backend/src/features/parser/utils/sanitizer.ts

/**
 * Task 3.3.3: Lọc bỏ các mẫu Prompt Injection nguy hiểm khỏi nội dung hóa đơn thô
 */
export function sanitizeRawContent(content?: string | null): string {
  if (!content || typeof content !== 'string') {
    return '';
  }

  return (
    content
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
