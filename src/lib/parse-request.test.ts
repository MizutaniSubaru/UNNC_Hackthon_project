import { describe, expect, it } from 'bun:test';
import { buildParseRequestText } from '@/lib/parse-request';

describe('buildParseRequestText', () => {
  it('returns text-only requests without extra labels', () => {
    expect(
      buildParseRequestText({
        text: 'Meet my advisor tomorrow at 3 PM',
      })
    ).toBe('Meet my advisor tomorrow at 3 PM');
  });

  it('returns image-only requests when text is empty', () => {
    expect(
      buildParseRequestText({
        imageText: 'Wednesday 14:00 Trent Building',
        text: '   ',
      })
    ).toBe('Wednesday 14:00 Trent Building');
  });

  it('combines text and OCR content into labeled sections', () => {
    expect(
      buildParseRequestText({
        imageText: 'Wednesday 14:00 Trent Building',
        text: 'Book my supervisor meeting',
      })
    ).toBe(
      'User request:\nBook my supervisor meeting\n\nExtracted from image:\nWednesday 14:00 Trent Building'
    );
  });

  it('drops blank OCR content after normalization', () => {
    expect(
      buildParseRequestText({
        imageText: ' \n  \n ',
        text: 'Submit the report',
      })
    ).toBe('Submit the report');
  });
});
