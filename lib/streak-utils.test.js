import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateDailyPostStreakState } from './streak-utils.ts';
import { isGoldSubscription } from './subscription.ts';
import { extractPlanPrice } from './plan-pricing.ts';

test('banked days cover a single missed day without wiping the streak', () => {
  const result = calculateDailyPostStreakState(
    {
      current_count: 3,
      current_start: '2024-01-01T00:00:00.000Z',
      longest_count: 4,
      banked_days: 1,
      bank_cap: 3,
      last_activity_at: '2024-01-03T00:00:00.000Z'
    },
    '2024-01-05T12:00:00.000Z',
    { isGold: false }
  );

  assert.equal(result.current_count, 4);
  assert.equal(result.banked_days, 0);
  assert.equal(result.longest_count, 4);
});

test('a gold user can keep momentum on the next day and maintain a higher cap', () => {
  const result = calculateDailyPostStreakState(
    {
      current_count: 6,
      current_start: '2024-01-01T00:00:00.000Z',
      longest_count: 7,
      banked_days: 1,
      bank_cap: 5,
      last_activity_at: '2024-01-07T00:00:00.000Z'
    },
    '2024-01-08T12:00:00.000Z',
    { isGold: true }
  );

  assert.equal(result.current_count, 7);
  assert.equal(result.banked_days, 2);
  assert.ok(result.bank_cap >= 5);
});

test('without a banked day, a long gap resets the streak to one', () => {
  const result = calculateDailyPostStreakState(
    {
      current_count: 3,
      current_start: '2024-01-01T00:00:00.000Z',
      longest_count: 4,
      banked_days: 0,
      bank_cap: 3,
      last_activity_at: '2024-01-03T00:00:00.000Z'
    },
    '2024-01-05T12:00:00.000Z',
    { isGold: false }
  );

  assert.equal(result.current_count, 1);
  assert.equal(result.banked_days, 0);
});

test('gold status is detected from the shared public.subscriptions plan payload shape', () => {
  const result = isGoldSubscription({
    user_id: 'user_123',
    status: 'active',
    current_period_end: '2025-01-31T00:00:00.000Z',
    plan: {
      name: 'Gold',
      product_name: 'wimpex'
    }
  });

  assert.equal(result, true);
});

test('plan price is pulled from the nested plan payload returned by WimpyPay', () => {
  const result = extractPlanPrice({
    ok: true,
    plan: {
      price: 999,
      billing_interval: 'monthly',
      name: 'Gold'
    }
  });

  assert.equal(result.price, 999);
  assert.equal(result.billing_interval, 'monthly');
});
