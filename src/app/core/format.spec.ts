import { istStamp } from './format';

describe('istStamp', () => {
  it('shows server UTC time as India time', () => {
    expect(istStamp('2026-10-26T07:37:00.000Z')).toBe('2026-10-26 13:07');
  });

  it('rolls the date over after 18:30 UTC', () => {
    expect(istStamp('2026-10-26T20:00:00.000Z')).toBe('2026-10-27 01:30');
  });

  it('falls back to the raw text when it is not a date', () => {
    expect(istStamp('not a date')).toBe('not a date');
  });
});
