export interface MemberEntity {
  id: number;
  zaloUserId?: string | null;
  telegramChatId?: string | null;
  displayName: string;
  role: 'ADMIN' | 'SUBSCRIBER' | 'CARD_OWNER';
  createdAt?: string;
}

export interface IMemberRepository {
  findById(id: number): Promise<MemberEntity | null>;
}
