import { describe, expect, it } from 'vitest';
import { minor } from '../src/finance.js';

describe('integer paisa financial arithmetic', () => {
  it('accepts integer strings and preserves exact large values', () => {
    expect(minor('30000')).toBe(30000n);
    expect(minor('1000000000000')).toBe(1000000000000n);
  });
  it.each(['0', '-1', '1.5', '1e3', ' 300', '৳300', '', '1000000000001'])('rejects invalid amount %s', value => {
    expect(() => minor(value)).toThrow();
  });
  it('never accepts JavaScript number amounts', () => expect(() => minor(300)).toThrow());
});
