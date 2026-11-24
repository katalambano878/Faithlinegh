// Make the small copies of a new product photo right after upload, so the
// first shopper doesn't wait for them (each one takes the server a moment,
// and on a weak signal a phone can give up and show a "?" instead).
// Server only. Fire-and-forget: errors are ignored.

// [width, quality] pairs the store actually asks for: colour swatches (q50),
// product-page thumbnails (q60), product cards (q75), main product photo (q80).
const WARM_SIZES: Array<[number, number]> = [
  [48, 50], [96, 50], [128, 50],
  [96, 60], [128, 60], [256, 60],
  [256, 75], [384, 75], [640, 75], [750, 75],
  [640, 80], [750, 80], [828, 80], [1080, 80], [1200, 80],
];

export function warmImageSizes(path: string): void {
  if (!/\.(jpe?g|png|webp|jfif|avif|heic)$/i.test(path)) return;
  const base = `http://127.0.0.1:${process.env.PORT || 3000}`;
  setTimeout(async () => {
    for (const [w, q] of WARM_SIZES) {
      try {
        const res = await fetch(`${base}/_next/image?url=${encodeURIComponent(path)}&w=${w}&q=${q}`, {
          headers: { Accept: "image/webp,image/*" },
          cache: "no-store",
        });
        await res.arrayBuffer();
      } catch {
        return; // server busy or shutting down; the shopper's request will make it
      }
    }
  }, 500);
}
