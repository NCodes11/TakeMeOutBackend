import { PlaceCandidate, PlacePhoto, Stop } from '@/types/models';

type MediaLike = {
  photoUrl?: string | null;
  photos?: PlacePhoto[] | null;
};

const firstPhotoUrl = (value?: PlacePhoto[] | null) => {
  if (!Array.isArray(value)) return undefined;

  for (const photo of value) {
    const url = photo?.url?.trim();
    if (url) return url;
  }

  return undefined;
};

export const resolvePrimaryPhotoUrl = (value?: MediaLike | null) => {
  const direct = value?.photoUrl?.trim();
  if (direct) return direct;
  return firstPhotoUrl(value?.photos);
};

const extractMetaContent = (html: string, attribute: string, value: string) => {
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `<meta[^>]+${attribute}=["']${escapedValue}["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+${attribute}=["']${escapedValue}["'][^>]*>`,
    'i',
  );
  const match = pattern.exec(html);
  return match?.[1] || match?.[2] || '';
};

const extractLinkHref = (html: string, relValue: string) => {
  const escapedValue = relValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `<link[^>]+rel=["']${escapedValue}["'][^>]+href=["']([^"']+)["'][^>]*>|<link[^>]+href=["']([^"']+)["'][^>]+rel=["']${escapedValue}["'][^>]*>`,
    'i',
  );
  const match = pattern.exec(html);
  return match?.[1] || match?.[2] || '';
};

export const extractPreviewImageUrl = (html: string, pageUrl: string) => {
  const raw =
    extractMetaContent(html, 'property', 'og:image') ||
    extractMetaContent(html, 'name', 'twitter:image') ||
    extractLinkHref(html, 'image_src');

  const trimmed = raw.trim();
  if (!trimmed) return '';

  try {
    return new URL(trimmed, pageUrl).toString();
  } catch {
    return '';
  }
};

export const fetchPreviewImageUrl = async (pageUrl?: string | null) => {
  const trimmed = pageUrl?.trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) return '';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(trimmed, {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });

    if (!response.ok) return '';

    const html = await response.text();
    return extractPreviewImageUrl(html, trimmed);
  } catch {
    return '';
  } finally {
    clearTimeout(timeout);
  }
};

export const withResolvedPhoto = async <T extends PlaceCandidate | Stop>(value: T): Promise<T> => {
  if (resolvePrimaryPhotoUrl(value)) return value;

  const previewUrl = await fetchPreviewImageUrl(value.websiteUri);
  if (!previewUrl) return value;

  return {
    ...value,
    photoUrl: previewUrl,
    photos:
      Array.isArray(value.photos) && value.photos.length > 0
        ? value.photos
        : [{ url: previewUrl }],
  };
};
