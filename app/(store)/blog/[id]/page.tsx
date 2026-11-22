import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import JsonLd from '@/components/JsonLd';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { pageMetadata, breadcrumbSchema, toPlainText } from '@/lib/seo';
import { sanitizeHtml } from '@/lib/sanitize';
import { imgSrc } from '@/lib/img';

export const dynamic = 'force-dynamic';

type Post = {
  id: string; slug: string | null; title: string; excerpt: string | null; content: string | null;
  featured_image: string | null; published_at: string | null; seo_title: string | null; seo_description: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getPost(key: string): Promise<Post | null> {
  try {
    const q = supabaseAdmin
      .from('blog_posts')
      .select('id, slug, title, excerpt, content, featured_image, published_at, seo_title, seo_description')
      .eq('status', 'published');
    const { data } = await (UUID.test(key) ? q.eq('id', key) : q.eq('slug', key)).maybeSingle();
    return (data as Post) || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return pageMetadata({ title: 'Post not found', path: `/blog/${id}`, noindex: true });
  return pageMetadata({
    title: post.seo_title || post.title,
    description: toPlainText(post.seo_description || post.excerpt || post.content || '', 160),
    path: `/blog/${post.slug || post.id}`,
    images: post.featured_image ? [post.featured_image] : undefined,
    type: 'article',
    publishedTime: post.published_at || undefined,
  });
}

export default async function BlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) notFound();

  const date = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const looksHtml = /<\/?[a-z][\s\S]*>/i.test(post.content || '');

  return (
    <main className="min-h-screen bg-white text-[#2B211B]">
      <JsonLd data={[breadcrumbSchema([{ name: 'Home', url: '/' }, { name: 'Style Notes', url: '/blog' }, { name: post.title, url: `/blog/${post.slug || post.id}` }])]} />
      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
        <Link href="/blog" className="text-sm text-[#5B4436] font-medium hover:underline">← Style Notes</Link>
        <h1 className="mt-4 font-serif text-4xl lg:text-5xl font-medium leading-tight">{post.title}</h1>
        {date && <p className="mt-3 text-sm text-[#6E6158]">{date}</p>}
        {post.featured_image && (
          <img {...imgSrc(post.featured_image, '(max-width: 768px) 100vw, 768px', 1200)} decoding="async" alt="" className="mt-8 w-full rounded-2xl object-cover max-h-[520px]" />
        )}
        {looksHtml ? (
          <div className="prose prose-stone max-w-none mt-8" dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content || '') }} />
        ) : (
          <div className="mt-8 space-y-4 text-[17px] leading-relaxed text-[#3A2F28]">
            {(post.content || '').split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
          </div>
        )}
        <div className="mt-12">
          <Link href="/shop" className="inline-flex h-12 px-6 items-center rounded-[14px] bg-[#5B4436] hover:bg-[#47362C] text-white font-semibold transition-colors">Shop the collection</Link>
        </div>
      </article>
    </main>
  );
}
