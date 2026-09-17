import { describe, expect, it } from 'vitest';
import { extractPreviewImageUrl, resolvePrimaryPhotoUrl } from '../src/utils/stopMedia';

describe('stop media helpers', () => {
  it('prefers photoUrl and falls back to first photo entry', () => {
    expect(
      resolvePrimaryPhotoUrl({
        photoUrl: '',
        photos: [{ url: 'https://example.com/photo.jpg' }],
      }),
    ).toBe('https://example.com/photo.jpg');

    expect(
      resolvePrimaryPhotoUrl({
        photoUrl: 'https://example.com/direct.jpg',
        photos: [{ url: 'https://example.com/photo.jpg' }],
      }),
    ).toBe('https://example.com/direct.jpg');
  });

  it('extracts preview images from page metadata and resolves relative URLs', () => {
    const html = `
      <html>
        <head>
          <meta property="og:image" content="/images/hero.jpg" />
        </head>
      </html>
    `;

    expect(extractPreviewImageUrl(html, 'https://example.com/places/kings-subs')).toBe(
      'https://example.com/images/hero.jpg',
    );
  });
});
