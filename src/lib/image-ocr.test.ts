import { describe, expect, it } from 'bun:test';
import { normalizeOcrText, resolveOcrLanguage } from '@/lib/image-ocr';

describe('image OCR helpers', () => {
  it('normalizes OCR text by removing blank lines and duplicate spacing', () => {
    expect(normalizeOcrText('  Meet   advisor  \n\n Trent   Building \r\n  3:00 PM  ')).toBe(
      'Meet advisor\nTrent Building\n3:00 PM'
    );
  });

  it('preserves mixed-language content while trimming noise', () => {
    expect(normalizeOcrText('  明天   3:00 PM  \n  Jubilee   Campus  ')).toBe(
      '明天 3:00 PM\nJubilee Campus'
    );
  });

  it('maps Chinese locales to the combined Chinese and English OCR language pack', () => {
    expect(resolveOcrLanguage('zh-CN')).toBe('chi_sim+eng');
  });

  it('maps non-Chinese locales to the combined English and Chinese OCR language pack', () => {
    expect(resolveOcrLanguage('en-US')).toBe('eng+chi_sim');
  });
});
