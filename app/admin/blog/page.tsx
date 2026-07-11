'use client';

import Link from 'next/link';

// The storefront blog is intentionally content-managed in code
// (app/(store)/blog). This page gives admins a live view of what's
// published rather than pretending to be an editor.
const publishedPosts = [
  {
    id: '1',
    title: 'The Ultimate Guide to Online Shopping in Ghana',
    category: 'Shopping Tips',
    date: 'December 15, 2024',
    readTime: '8 min read',
    featured: true,
  },
  {
    id: '2',
    title: '10 Must-Have Products for Your Home This Season',
    category: 'Home & Living',
    date: 'December 12, 2024',
    readTime: '6 min read',
    featured: false,
  },
  {
    id: '3',
    title: "How to Choose Quality Products: A Buyer's Guide",
    category: 'Buying Guide',
    date: 'December 10, 2024',
    readTime: '7 min read',
    featured: false,
  },
];

export default function AdminBlogPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Blog Posts</h1>
          <p className="text-gray-600 mt-1">Published articles on the storefront blog</p>
        </div>
        <Link
          href="/blog"
          target="_blank"
          className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap"
        >
          <i className="ri-external-link-line mr-2"></i>
          View Live Blog
        </Link>
      </div>

      <div className="bg-[#A8826B]/5 border border-[#A8826B]/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <i className="ri-information-line text-xl text-[#A8826B] mt-0.5"></i>
          <div className="text-sm text-[#5A4234]">
            <p className="font-semibold mb-1">Blog content is managed in code</p>
            <p>
              Posts live in the site source (<code className="bg-white/60 px-1 rounded">app/(store)/blog</code>) and are
              deployed with the website. To add or edit a post, ask your developer to update the blog pages and redeploy.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
        {publishedPosts.map((post) => (
          <div key={post.id} className="flex items-center justify-between p-5 gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-900 truncate">{post.title}</h3>
                {post.featured && (
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-[#A8826B]/10 text-[#A8826B] whitespace-nowrap">
                    Featured
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                {post.category} • {post.date} • {post.readTime}
              </p>
            </div>
            <Link
              href={`/blog/${post.id}`}
              target="_blank"
              className="text-sm font-semibold text-gray-700 hover:text-gray-900 whitespace-nowrap"
            >
              View
              <i className="ri-arrow-right-up-line ml-1"></i>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
