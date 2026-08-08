import { describe, it, expect } from 'vitest';
import {
  SubscriptionStatus,
  SubscriptionAction,
  transitionSubscriptionState,
  InvalidStateTransitionError,
} from './subscription.entity';

describe('Subscription State Machine (FSM)', () => {
  it('TC-01: TRIAL + KEEP -> ACTIVE (BR-04)', () => {
    const nextStatus = transitionSubscriptionState(
      SubscriptionStatus.TRIAL,
      SubscriptionAction.KEEP
    );
    expect(nextStatus).toBe(SubscriptionStatus.ACTIVE);
  });

  it('TC-02: TRIAL + KILL -> PENDING_KILL', () => {
    const nextStatus = transitionSubscriptionState(
      SubscriptionStatus.TRIAL,
      SubscriptionAction.KILL
    );
    expect(nextStatus).toBe(SubscriptionStatus.PENDING_KILL);
  });

  it('TC-03: ACTIVE + KILL -> PENDING_KILL', () => {
    const nextStatus = transitionSubscriptionState(
      SubscriptionStatus.ACTIVE,
      SubscriptionAction.KILL
    );
    expect(nextStatus).toBe(SubscriptionStatus.PENDING_KILL);
  });

  it('TC-04: PENDING_KILL + CONFIRM_KILLED -> KILLED', () => {
    const nextStatus = transitionSubscriptionState(
      SubscriptionStatus.PENDING_KILL,
      SubscriptionAction.CONFIRM_KILLED
    );
    expect(nextStatus).toBe(SubscriptionStatus.KILLED);
  });

  it('Ném InvalidStateTransitionError khi gọi action không hợp lệ trên TRIAL', () => {
    expect(() =>
      transitionSubscriptionState(SubscriptionStatus.TRIAL, SubscriptionAction.CONFIRM_KILLED)
    ).toThrow(InvalidStateTransitionError);
  });

  it('Cho phép action KEEP trên ACTIVE giữ nguyên trạng thái ACTIVE', () => {
    const nextStatus = transitionSubscriptionState(
      SubscriptionStatus.ACTIVE,
      SubscriptionAction.KEEP
    );
    expect(nextStatus).toBe(SubscriptionStatus.ACTIVE);
  });

  it('Ném InvalidStateTransitionError khi gọi action bất kỳ trực tiếp trên KILLED', () => {
    expect(() =>
      transitionSubscriptionState(SubscriptionStatus.KILLED, SubscriptionAction.KEEP)
    ).toThrow(InvalidStateTransitionError);

    expect(() =>
      transitionSubscriptionState(SubscriptionStatus.KILLED, SubscriptionAction.KILL)
    ).toThrow(InvalidStateTransitionError);
  });
});
