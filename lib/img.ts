// Serve photos through Next's built-in resizer (/_next/image), so a phone
// downloads a small AVIF/WebP sized for its screen instead of the original
// upload (some originals are 2 MB). Works for our own files: uploaded photos
// under /storage/... and images in /public.

// Must match images.deviceSizes / imageSizes in next.config.ts, or the
// resizer rejects the request.
const WIDTHS = [96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920];

const OWN_ORIGIN = /^https?:\/\/(www\.)?faithlinegh\.com(?=\/)/i;

export function canOptimize(src: unknown): src is string {
  if (typeof src !== 'string' || !src) return false;
  const path = src.replace(OWN_ORIGIN, '');
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/_next/')) return false;
  return !/\.(svg|gif)(\?|$)/i.test(path);
}

/** Our own photo URLs as a site path (/storage/...), so Next's resizer reads
 *  them inside the server instead of over the internet, and every page asks
 *  for the same cached copy. Other URLs are returned unchanged. */
export function localImagePath<T extends string | null | undefined>(src: T): T {
  return (typeof src === 'string' ? src.replace(OWN_ORIGIN, '') : src) as T;
}

function resized(path: string, w: number, q: number) {
  return `/_next/image?url=${encodeURIComponent(path)}&w=${w}&q=${q}`;
}

/**
 * Props for a plain <img>: src + srcSet + sizes.
 *   <img {...imgSrc(url, '96px', 256)} alt="" loading="lazy" />
 * `sizes` says how wide the image shows on screen; `maxWidth` caps the
 * largest file offered (thumbnails never need more than 256px).
 */
export function imgSrc(src: string | null | undefined, sizes = '100vw', maxWidth = 1920, quality = 75) {
  if (!canOptimize(src)) return { src: src || undefined };
  const path = src.replace(OWN_ORIGIN, '');
  const widths = WIDTHS.filter((w) => w <= maxWidth);
  if (widths.length === 0) widths.push(WIDTHS[0]);
  const fallback = widths.find((w) => w >= 640) ?? widths[widths.length - 1];
  return {
    src: resized(path, fallback, quality),
    srcSet: widths.map((w) => `${resized(path, w, quality)} ${w}w`).join(', '),
    sizes,
  };
}
