'use client';

import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import PageHero from '@/components/PageHero';
import { useWishlist } from '@/context/WishlistContext';
import ProductCard from '@/components/ProductCard';
import { usePageTitle } from '@/hooks/usePageTitle';
import { supabase } from '@/lib/supabase';

export default function WishlistPage() {
  usePageTitle('Wishlist');
  const { wishlist: wishlistItems, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();

  const addAllToCart = async () => {
    const ids = wishlistItems.filter(item => item.inStock).map(item => item.id);
    if (ids.length === 0) return;
    // Current stock, minimum order and options come from the store, not the saved wishlist
    const { data } = await supabase
      .from('products')
      .select('id, name, slug, price, quantity, moq, status, product_variants(id)')
      .in('id', ids);
    const added: string[] = [];
    const needsChoice: string[] = [];
    for (const item of wishlistItems.filter(i => ids.includes(i.id))) {
      const p: any = (data || []).find((d: any) => d.id === item.id);
      if (!p || p.status !== 'active' || Number(p.quantity) <= 0) continue;
      if ((p.product_variants || []).length > 0) { needsChoice.push(p.name); continue; }
      const moq = Math.max(1, Number(p.moq) || 1);
      if (Number(p.quantity) < moq) continue;
      addToCart({
        id: p.id,
        name: p.name,
        price: Number(p.price) || item.price,
        image: item.image,
        quantity: moq,
        slug: p.slug || item.slug || item.id,
        maxStock: Number(p.quantity),
        moq,
      });
      added.push(p.name);
    }
    const parts: string[] = [];
    if (added.length) parts.push(`Added ${added.length} ${added.length === 1 ? 'item' : 'items'} to your bag.`);
    if (needsChoice.length) parts.push(`Choose a size or colour for: ${needsChoice.join(', ')}.`);
    if (!parts.length) parts.push('None of these items are available right now.');
    alert(parts.join(' '));
  };

  return (
    <main className="min-h-screen bg-white">
      <PageHero title="My Wishlist" image="/wishlist.jpeg" />

      <section className="py-8 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <nav className="flex items-center space-x-2 text-sm mb-2">
                <Link href="/" className="text-gray-600 hover:text-gray-900 transition-colors">Home</Link>
                <i className="ri-arrow-right-s-line text-gray-400"></i>
                <span className="text-gray-900 font-medium">Wishlist</span>
              </nav>
              <p className="text-gray-600">
                {wishlistItems.length} {wishlistItems.length === 1 ? 'item' : 'items'} saved
              </p>
            </div>
            {wishlistItems.length > 0 && (
              <button
                onClick={addAllToCart}
                className="bg-brand-brown hover:bg-[#47362C] text-white px-6 py-3 rounded-full font-semibold transition-colors whitespace-nowrap shadow-md shadow-brand-brown/20"
              >
                Add All to Cart
              </button>
            )}
          </div>
        </div>
      </section>

      {wishlistItems.length === 0 ? (
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
            <div className="w-24 h-24 flex items-center justify-center mx-auto mb-6 bg-white rounded-full ring-1 ring-brand-carton/20">
              <i className="ri-heart-line text-5xl text-brand-carton"></i>
            </div>
            <h2 className="text-3xl font-bold text-brand-brown mb-4">Your wishlist is empty</h2>
            <p className="text-brand-brown/60 mb-8 text-lg">Save your favourite items here to easily find them later</p>
            <Link href="/shop" className="inline-block bg-brand-brown hover:bg-[#47362C] text-white px-8 py-4 rounded-full font-semibold transition-colors whitespace-nowrap shadow-md shadow-brand-brown/20">
              Explore Products
            </Link>
          </div>
        </section>
      ) : (
        <section className="py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {wishlistItems.map((product) => (
                <div key={product.id} className="relative">
                  <ProductCard {...product} slug={product.slug || product.id} />
                  <button
                    onClick={() => removeFromWishlist(product.id)}
                    className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-md hover:bg-[#E6DFD5]/50 transition-colors z-10"
                  >
                    <i className="ri-close-line text-gray-700 text-xl"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="bg-gradient-to-br from-brand-carton via-brand-tan to-brand-brown rounded-2xl p-12 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">Share Your Wishlist</h2>
            <p className="text-gray-200 mb-8 text-lg">Let friends and family know what you love</p>
            <div className="flex justify-center space-x-4">
              <button className="w-12 h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                <i className="ri-facebook-fill text-xl"></i>
              </button>
              <button className="w-12 h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                <i className="ri-twitter-x-fill text-xl"></i>
              </button>
              <button className="w-12 h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                <i className="ri-whatsapp-fill text-xl"></i>
              </button>
              <button className="w-12 h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                <i className="ri-mail-fill text-xl"></i>
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
