import { describe, test, expect } from 'bun:test';

/**
 * We can't import config.ts directly (it reads env and loads .env).
 * Instead, we replicate the two pure parsing functions here for testing.
 * If the functions were exported, we'd import them directly.
 */

function parseNumberList(input: string): number[] {
  return input
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}

function parseTrustedGroupTopics(input: string): Map<number, Set<number>> {
  const result = new Map<number, Set<number>>();

  for (const entry of input.split(/[;|]/)) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const [chatIdRaw, topicIdsRaw] = trimmed.split(':');
    const chatId = Number(chatIdRaw?.trim());
    if (!Number.isFinite(chatId) || !topicIdsRaw) continue;

    const topicIds = parseNumberList(topicIdsRaw);
    if (topicIds.length === 0) continue;

    const existing = result.get(chatId) ?? new Set<number>();
    for (const topicId of topicIds) {
      existing.add(topicId);
    }
    result.set(chatId, existing);
  }

  return result;
}

// ─── parseNumberList ──────────────────────────

describe('parseNumberList', () => {
  test('parses comma-separated numbers', () => {
    expect(parseNumberList('1,2,3')).toEqual([1, 2, 3]);
  });

  test('handles spaces', () => {
    expect(parseNumberList(' 1 , 2 , 3 ')).toEqual([1, 2, 3]);
  });

  test('handles empty string', () => {
    expect(parseNumberList('')).toEqual([]);
  });

  test('filters out NaN values', () => {
    expect(parseNumberList('1,abc,3')).toEqual([1, 3]);
  });

  test('handles negative numbers', () => {
    expect(parseNumberList('-1001,-1002')).toEqual([-1001, -1002]);
  });

  test('handles single value', () => {
    expect(parseNumberList('42')).toEqual([42]);
  });

  test('handles trailing comma', () => {
    expect(parseNumberList('1,2,')).toEqual([1, 2]);
  });
});

// ─── parseTrustedGroupTopics ──────────────────

describe('parseTrustedGroupTopics', () => {
  test('parses single group with single topic', () => {
    const result = parseTrustedGroupTopics('-1001:10');
    expect(result.size).toBe(1);
    expect(result.get(-1001)).toEqual(new Set([10]));
  });

  test('parses single group with multiple topics', () => {
    const result = parseTrustedGroupTopics('-1001:10,11,12');
    expect(result.get(-1001)).toEqual(new Set([10, 11, 12]));
  });

  test('parses multiple groups separated by semicolon', () => {
    const result = parseTrustedGroupTopics('-1001:10,11;-1002:5');
    expect(result.size).toBe(2);
    expect(result.get(-1001)).toEqual(new Set([10, 11]));
    expect(result.get(-1002)).toEqual(new Set([5]));
  });

  test('parses multiple groups separated by pipe', () => {
    const result = parseTrustedGroupTopics('-1001:10|-1002:5');
    expect(result.size).toBe(2);
    expect(result.get(-1001)).toEqual(new Set([10]));
    expect(result.get(-1002)).toEqual(new Set([5]));
  });

  test('handles empty string', () => {
    const result = parseTrustedGroupTopics('');
    expect(result.size).toBe(0);
  });

  test('handles whitespace', () => {
    const result = parseTrustedGroupTopics(' -1001 : 10 , 11 ; -1002 : 5 ');
    expect(result.get(-1001)).toEqual(new Set([10, 11]));
    expect(result.get(-1002)).toEqual(new Set([5]));
  });

  test('skips entries without topic IDs', () => {
    const result = parseTrustedGroupTopics('-1001:;-1002:5');
    expect(result.size).toBe(1);
    expect(result.get(-1002)).toEqual(new Set([5]));
  });

  test('skips entries with invalid chatId', () => {
    const result = parseTrustedGroupTopics('abc:10;-1002:5');
    expect(result.size).toBe(1);
    expect(result.get(-1002)).toEqual(new Set([5]));
  });

  test('merges duplicate chatIds', () => {
    const result = parseTrustedGroupTopics('-1001:10;-1001:20');
    expect(result.get(-1001)).toEqual(new Set([10, 20]));
  });
});

// ─── Topic filtering logic ───────────────────

describe('isAllowedTopic', () => {
  function isAllowedTopic(
    trustedGroupTopics: Map<number, Set<number>>,
    chatId: number,
    messageThreadId?: number,
  ): boolean {
    const allowedTopics = trustedGroupTopics.get(chatId);
    if (!allowedTopics) return true;
    if (typeof messageThreadId !== 'number') return false;
    return allowedTopics.has(messageThreadId);
  }

  const topics = parseTrustedGroupTopics('-1001:10,11;-1002:5');

  test('allows message in configured topic', () => {
    expect(isAllowedTopic(topics, -1001, 10)).toBe(true);
    expect(isAllowedTopic(topics, -1001, 11)).toBe(true);
    expect(isAllowedTopic(topics, -1002, 5)).toBe(true);
  });

  test('rejects message in non-configured topic', () => {
    expect(isAllowedTopic(topics, -1001, 99)).toBe(false);
  });

  test('rejects message without topic when group requires topics', () => {
    expect(isAllowedTopic(topics, -1001, undefined)).toBe(false);
  });

  test('allows any message from groups without topic restrictions', () => {
    expect(isAllowedTopic(topics, -9999, undefined)).toBe(true);
    expect(isAllowedTopic(topics, -9999, 42)).toBe(true);
  });

  test('allows any message when no topic restrictions configured', () => {
    const empty = new Map<number, Set<number>>();
    expect(isAllowedTopic(empty, -1001, undefined)).toBe(true);
    expect(isAllowedTopic(empty, -1001, 10)).toBe(true);
  });
});
