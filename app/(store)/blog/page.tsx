import type { Metadata } from 'next';
import Link from 'next/link';
import JsonLd from '@/components/JsonLd';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { pageMetadata, breadcrumbSchema, collectionPageSchema, SITE_NAME } from '@/lib/seo';
import { imgSrc } from '@/lib/img';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = pageMetadata({
  title: 'Style Notes',
  description: `Style tips and new-in notes from ${SITE_NAME}: how to wear our bags, basics and dresses.`,
  path: '/blog',
  type: 'website',
});

type Post = { id: string; slug: string | null; title: string; excerpt: string | null; featured_image: string | null; published_at: string | null };

/** Posts published from the admin Blog module. */
async function getPosts(): Promise<Post[]> {
  try {
    const { data } = await supabaseAdmin
      .from('blog_posts')
      .select('id, slug, title, excerpt, featured_image, published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(60);
    return (data as Post[]) || [];
  } catch {
    return [];
  }
}

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

export default async function BlogPage() {
  const posts = await getPosts();

  return (
    <main className="min-h-screen bg-white text-[#2B211B]">
      <JsonLd
        data={[
          collectionPageSchema({ name: `Style Notes — ${SITE_NAME}`, description: 'Style tips and new-in notes.', url: '/blog' }),
          breadcrumbSchema([{ name: 'Home', url: '/' }, { name: 'Style Notes', url: '/blog' }]),
        ]}
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <h1 className="font-serif text-4xl lg:text-5xl font-medium">Style Notes</h1>
        <p className="mt-3 text-[#4E423A] max-w-[60ch]">How to wear our bags, basics and dresses, plus what&apos;s new in store.</p>

        {posts.length === 0 ? (
          <div className="mt-12 rounded-2xl bg-[#F7F4EF] p-8 sm:p-10 max-w-2xl">
            <h2 className="font-serif text-2xl font-medium">No posts yet</h2>
            <p className="mt-2 text-[#4E423A]">We&apos;re working on our first style notes. In the meantime, see what just landed.</p>
            <Link href="/shop?sort=new" className="mt-5 inline-flex h-12 px-6 items-center rounded-[14px] bg-[#5B4436] hover:bg-[#47362C] text-white font-semibold transition-colors">
              Shop new arrivals
            </Link>
          </div>
        ) : (
          <ul className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((p) => (
              <li key={p.id}>
                <Link href={`/blog/${p.slug || p.id}`} className="group block">
                  <div className="aspect-[4/3] rounded-2xl bg-[#F7F4EF] overflow-hidden">
                    {p.featured_image && (
                      <img {...imgSrc(p.featured_image, '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw', 828)} decoding="async" alt="" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" loading="lazy" />
                    )}
                  </div>
                  <p className="mt-3 text-xs text-[#6E6158]">{fmt(p.published_at)}</p>
                  <h2 className="mt-1 font-serif text-xl font-medium group-hover:underline underline-offset-4">{p.title}</h2>
                  {p.excerpt && <p className="mt-1 text-sm text-[#4E423A] line-clamp-3">{p.excerpt}</p>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
