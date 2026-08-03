-- Clean up existing seed data
DELETE FROM parsing_logs;
DELETE FROM alerts;
DELETE FROM subscriptions;
DELETE FROM payment_cards;
DELETE FROM members;

-- 1. Seed Members (Admin, Card Owner, Subscriber)
INSERT INTO members (id, zalo_user_id, telegram_chat_id, display_name, role) VALUES
(1, 'zalo_admin_01', '123456789', 'Bố (Admin)', 'ADMIN'),
(2, 'zalo_mom_02', NULL, 'Mẹ (Thẻ chính)', 'CARD_OWNER'),
(3, NULL, '987654321', 'Con Trai', 'SUBSCRIBER');

-- 2. Seed Payment Cards (Tuân thủ BR-09)
INSERT INTO payment_cards (id, card_label, card_owner_id, last_four, is_active) VALUES
(1, 'Techcombank Visa Signature', 2, '8888', 1),
(2, 'VPBank Mastercard StepUp', 1, '1234', 1);

-- 3. Seed Subscriptions (ĐẦY ĐỦ 4 TRẠNG THÁI: TRIAL, ACTIVE, PENDING_KILL, KILLED)
INSERT INTO subscriptions (
  id, merchant_name, amount, currency, subscriber_id, payment_card_id, 
  status, billing_cycle, next_billing_date, confidence_score, direct_kill_link, is_must_keep
) VALUES
-- 1. TRIAL: Sắp hết hạn dùng thử (Test Alert RED_T24 / Kill Switch)
(1, 'Spotify Premium Trial', 0, 'VND', 3, 2, 'TRIAL', 'MONTHLY', '2026-08-06', 0.98, 'https://spotify.com/account/cancel', 0),

-- 2. ACTIVE: Dịch vụ thường niên đang gia hạn
(2, 'Netflix Premium 4K', 260000, 'VND', 1, 1, 'ACTIVE', 'MONTHLY', '2026-08-15', 0.95, 'https://www.netflix.com/youraccount', 0),

-- 3. PENDING_KILL: Đã chọn Kill, chờ Cron Job xử lý
(3, 'YouTube Premium Trial', 0, 'VND', 3, 2, 'PENDING_KILL', 'MONTHLY', '2026-08-05', 0.96, 'https://youtube.com/paid_memberships', 0),

-- 4. KILLED: Đã hủy thành công (dùng test Re-open)
(4, 'ChatGPT Plus', 500000, 'VND', 1, 2, 'KILLED', 'MONTHLY', '2026-07-20', 0.99, NULL, 0),

-- 5. ACTIVE MUST_KEEP: Thiết yếu gia đình (BR-02)
(5, 'iCloud+ 200GB Family', 59000, 'VND', 2, 1, 'ACTIVE', 'MONTHLY', '2026-08-28', 0.99, NULL, 1);

-- 4. Seed Alerts
INSERT INTO alerts (id, subscription_id, alert_type, scheduled_at, status, response) VALUES
(1, 1, 'RED_T24', '2026-08-05 09:00:00', 'SCHEDULED', 'PENDING'),
(2, 2, 'SOFT_T3', '2026-08-12 09:00:00', 'SCHEDULED', 'PENDING');

-- 5. Seed Parsing Logs
INSERT INTO parsing_logs (id, source, sender_id, raw_content, parsed_json, confidence_score, status) VALUES
(1, 'EMAIL', 'billing@spotify.com', 'Your Spotify Premium trial expires in 3 days...', '{"merchant":"Spotify","amount":0,"currency":"VND"}', 0.98, 'SUCCESS'),
(2, 'CHAT_TG', '987654321', 'https://images.cloudflare.com/receipt.jpg', '{"merchant":"Canva","amount":149000,"currency":"VND"}', 0.92, 'SUCCESS');