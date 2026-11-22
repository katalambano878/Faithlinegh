import { NextResponse } from 'next/server';
import { requireScreen } from '@/lib/admin-auth';
import { OPENROUTER_CHAT_URL, getOpenRouterKey, openRouterHeaders, visionModel } from '@/lib/openrouter';

export const maxDuration = 30;

/** Shorten to `max` characters at a sentence or word break, never mid-word. */
function fit(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '));
  if (sentence > max * 0.6) return cut.slice(0, sentence + 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:–-]$/, '')}.`;
}

/**
 * Writes a search title, description and tags for a product from its name,
 * description, category, colours and (when there is one) its first photo.
 */
export async function POST(request: Request) {
  const auth = await requireScreen(request, 'products');
  if (auth.error) return auth.error;

  const key = getOpenRouterKey();
  if (!key) return NextResponse.json({ error: 'The writing assistant is not set up on this store.' }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const name = String(body.productName || '').trim().slice(0, 120);
  if (!name) return NextResponse.json({ error: 'Give the product a name first.' }, { status: 400 });
  const description = String(body.description || '').trim().slice(0, 1500);
  const category = String(body.category || '').trim().slice(0, 60);
  const colors = Array.isArray(body.colors) ? body.colors.map((c: unknown) => String(c)).slice(0, 12) : [];
  const imageUrl = typeof body.imageUrl === 'string' && /^https:\/\//.test(body.imageUrl) ? body.imageUrl : null;

  const facts = [
    `Product name: ${name}`,
    category && `Category: ${category}`,
    colors.length && `Colours: ${colors.join(', ')}`,
    description && `Description: ${description}`,
  ].filter(Boolean).join('\n');

  const instructions =
    'You write search listings for Faithlinegh, a Ghanaian online fashion store (bags, basics, dresses, co-ord sets) in Accra. ' +
    'Customers can collect free from the store within 24 hours or get delivery anywhere in Ghana within 48 hours. Payment is Mobile Money or card. ' +
    'Return JSON only: {"title": string, "description": string, "tags": string[]}. ' +
    'title: max 46 characters, in Title Case, the product name plus one helpful word (type, fabric or colour); do NOT add the store name. ' +
    'description: 120-150 characters (count them), plain sentence(s): what it is, one real benefit, and that it is available for pickup or delivery in Ghana. ' +
    'Do not invent facts (fabric, sizes, prices, discounts) that are not in the details or clearly visible in the photo. No emojis, no hashtags, no ALL CAPS. ' +
    'tags: 5-8 lowercase search phrases Ghanaian shoppers would type, e.g. "ladies two piece set", "co-ord set accra".';

  const content: any[] = [{ type: 'text', text: facts }];
  if (imageUrl) content.push({ type: 'image_url', image_url: { url: imageUrl } });

  try {
    const res = await fetch(OPENROUTER_CHAT_URL, {
      method: 'POST',
      headers: openRouterHeaders(key),
      body: JSON.stringify({
        model: visionModel(),
        messages: [{ role: 'system', content: instructions }, { role: 'user', content }],
        temperature: 0.4,
        max_tokens: 400,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      console.error('[generate-seo]', res.status, (await res.text()).slice(0, 300));
      return NextResponse.json({ error: 'The writing assistant is busy. Try again in a moment.' }, { status: 502 });
    }
    const data = await res.json();
    const raw = String(data.choices?.[0]?.message?.content || '');
    const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    const title = fit(String(json.title || '').replace(/\s*[|–—-]\s*faithline(gh)?\s*$/i, ''), 46).replace(/\.$/, '');
    const descriptionOut = fit(String(json.description || ''), 160);
    const tags = Array.isArray(json.tags) ? json.tags.map((t: unknown) => String(t).toLowerCase().trim()).filter((t: string) => t && t.length <= 40).slice(0, 8) : [];
    if (!title && !descriptionOut) throw new Error('empty');
    return NextResponse.json({ title, description: descriptionOut, tags });
  } catch (err: any) {
    console.error('[generate-seo] failed:', err?.message);
    return NextResponse.json({ error: 'Could not write it right now. Try again, or use “Fill from product details”.' }, { status: 502 });
  }
}
