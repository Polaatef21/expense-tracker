import { describe, expect, it } from 'vitest';
import { describeError } from '../src/utils/describeError.js';

describe('describeError', () => {
  it('uses the message of a normal error', () => {
    expect(describeError(new Error('boom'))).toBe('boom');
  });

  it('adds the error code when the message does not contain it', () => {
    const err = Object.assign(new Error('connection failed'), { code: 'ECONNRESET' });
    expect(describeError(err)).toBe('connection failed [ECONNRESET]');
  });

  it('describes an AggregateError with an empty message via its code and inner errors', () => {
    const v6 = Object.assign(new Error('connect ECONNREFUSED ::1:1'), { code: 'ECONNREFUSED' });
    const v4 = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:1'), { code: 'ECONNREFUSED' });
    const agg = Object.assign(new AggregateError([v6, v4], ''), { code: 'ECONNREFUSED' });
    expect(describeError(agg)).toBe(
      '[ECONNREFUSED] (connect ECONNREFUSED ::1:1; connect ECONNREFUSED 127.0.0.1:1)',
    );
  });

  it('handles non-Error values', () => {
    expect(describeError('plain string')).toBe('plain string');
  });
});
