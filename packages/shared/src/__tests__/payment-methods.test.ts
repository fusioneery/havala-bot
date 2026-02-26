import { describe, test, expect } from 'bun:test';
import { hasPaymentMethodOverlap } from '../payment-methods';

describe('hasPaymentMethodOverlap', () => {
  // ─── Both sides have matching methods ────────
  test('returns true when both sides share a method for the currency', () => {
    const a = [{ currency: 'RUB', methods: ['russian_banks', 'swift'] }];
    const b = [{ currency: 'RUB', methods: ['russian_banks'] }];
    expect(hasPaymentMethodOverlap(a, b, 'RUB')).toBe(true);
  });

  test('returns false when no shared methods for the currency', () => {
    const a = [{ currency: 'RUB', methods: ['russian_banks'] }];
    const b = [{ currency: 'RUB', methods: ['crypto'] }];
    expect(hasPaymentMethodOverlap(a, b, 'RUB')).toBe(false);
  });

  // ─── Empty sides = no restriction ───────────
  test('returns true when side A has no entries for the currency', () => {
    const a = [{ currency: 'EUR', methods: ['swift'] }]; // different currency
    const b = [{ currency: 'RUB', methods: ['russian_banks'] }];
    expect(hasPaymentMethodOverlap(a, b, 'RUB')).toBe(true);
  });

  test('returns true when side B has no entries for the currency', () => {
    const a = [{ currency: 'RUB', methods: ['russian_banks'] }];
    const b = [{ currency: 'EUR', methods: ['swift'] }]; // different currency
    expect(hasPaymentMethodOverlap(a, b, 'RUB')).toBe(true);
  });

  test('returns true when both sides are empty', () => {
    expect(hasPaymentMethodOverlap([], [], 'RUB')).toBe(true);
  });

  test('returns true when side A is empty array', () => {
    const b = [{ currency: 'RUB', methods: ['russian_banks'] }];
    expect(hasPaymentMethodOverlap([], b, 'RUB')).toBe(true);
  });

  test('returns true when side B is empty array', () => {
    const a = [{ currency: 'RUB', methods: ['russian_banks'] }];
    expect(hasPaymentMethodOverlap(a, [], 'RUB')).toBe(true);
  });

  // ─── Multiple currencies in groups ──────────
  test('only checks methods matching the given currency', () => {
    const a = [
      { currency: 'RUB', methods: ['russian_banks'] },
      { currency: 'EUR', methods: ['swift'] },
    ];
    const b = [
      { currency: 'RUB', methods: ['crypto'] }, // no overlap for RUB
      { currency: 'EUR', methods: ['swift'] },
    ];
    expect(hasPaymentMethodOverlap(a, b, 'RUB')).toBe(false);
    expect(hasPaymentMethodOverlap(a, b, 'EUR')).toBe(true);
  });

  // ─── Multiple methods in one group ──────────
  test('matches if any one method overlaps', () => {
    const a = [{ currency: 'EUR', methods: ['swift', 'local_banks', 'crypto'] }];
    const b = [{ currency: 'EUR', methods: ['crypto'] }];
    expect(hasPaymentMethodOverlap(a, b, 'EUR')).toBe(true);
  });

  // ─── Crypto-specific ───────────────────────
  test('crypto methods match for stablecoin currencies', () => {
    const a = [{ currency: 'USDT', methods: ['crypto'] }];
    const b = [{ currency: 'USDT', methods: ['crypto'] }];
    expect(hasPaymentMethodOverlap(a, b, 'USDT')).toBe(true);
  });

  test('crypto vs banks does not match', () => {
    const a = [{ currency: 'RUB', methods: ['crypto'] }];
    const b = [{ currency: 'RUB', methods: ['russian_banks'] }];
    expect(hasPaymentMethodOverlap(a, b, 'RUB')).toBe(false);
  });

  // ─── CIS local banks ──────────────────────
  test('local_banks match for CIS currencies', () => {
    const a = [{ currency: 'GEL', methods: ['local_banks'] }];
    const b = [{ currency: 'GEL', methods: ['local_banks', 'swift'] }];
    expect(hasPaymentMethodOverlap(a, b, 'GEL')).toBe(true);
  });

  test('swift and local_banks do not overlap', () => {
    const a = [{ currency: 'GEL', methods: ['swift'] }];
    const b = [{ currency: 'GEL', methods: ['local_banks'] }];
    expect(hasPaymentMethodOverlap(a, b, 'GEL')).toBe(false);
  });
});
