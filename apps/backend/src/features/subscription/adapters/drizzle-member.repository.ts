import { eq } from 'drizzle-orm';
import { members } from '@/core/db/schema';
import type { IMemberRepository, MemberEntity } from '../domain/member-repository.interface';

export class DrizzleMemberRepository implements IMemberRepository {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private db: any) {}

  async findById(id: number): Promise<MemberEntity | null> {
    const rows = await this.db.select().from(members).where(eq(members.id, id));
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      zaloUserId: r.zaloUserId ?? null,
      telegramChatId: r.telegramChatId ?? null,
      displayName: r.displayName,
      role: r.role,
      createdAt: r.createdAt,
    };
  }
}
