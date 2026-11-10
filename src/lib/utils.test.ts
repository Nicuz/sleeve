import { describe, expect, test } from 'bun:test';
import { parsePriceInput, pluralize } from './utils';

describe('parsePriceInput', () => {
  test('accepts comma and dot decimals', () => {
    expect(parsePriceInput('3,50')).toBe(3.5);
    expect(parsePriceInput('3.50')).toBe(3.5);
  });

  test('handles thousands separators', () => {
    expect(parsePriceInput('1.234,56')).toBe(1234.56);
    expect(parsePriceInput('1,234.56')).toBe(1234.56);
  });

  test('returns null for empty or invalid values', () => {
    expect(parsePriceInput('')).toBeNull();
    expect(parsePriceInput('free')).toBeNull();
    expect(parsePriceInput('-5')).toBeNull();
  });
});

describe('pluralize', () => {
  test('uses singular and plural forms', () => {
    expect(pluralize(1, 'record')).toBe('1 record');
    expect(pluralize(2, 'record')).toBe('2 records');
    expect(pluralize(2, 'entry', 'entries')).toBe('2 entries');
  });
});
