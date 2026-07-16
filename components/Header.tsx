'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import MiniCart from './MiniCart';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
import { useCMS } from '@/context/CMSContext';
import MarqueeBanner from './MarqueeBanner';

export default function Header() {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [wishlistCount, setWishlistCount] = useState(0);
  const [user, setUser] = useState<any>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const overlayHeader = false;

  const { cartCount, isCartOpen, setIsCartOpen } = useCart();
  const { getSetting } = useCMS();

  const siteName = getSetting('site_name') || 'Faithlinegh';

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });

    const updateWishlistCount = () => {
      const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
      setWishlistCount(wishlist.length);
    };
    updateWishlistCount();
    window.addEventListener('wishlistUpdated', updateWishlistCount);

    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('wishlistUpdated', updateWishlistCount);
      subscription.unsubscribe();
    };
  }, []);

  // Lock body scroll while overlays are open
  useEffect(() => {
    const open = isMobileMenuOpen || isSearchOpen;
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen, isSearchOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/shop?search=${encodeURIComponent(searchQuery)}`;
    }
  };

  const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'Shop', href: '/shop' },
    { label: 'Sale', href: '/sale' },
    { label: 'Categories', href: '/categories' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ];

  const desktopNavLinks = [
    { label: 'New In', href: '/shop?sort=new' },
    { label: 'Shop', href: '/shop' },
    { label: 'Collections', href: '/categories' },
    { label: 'Sale', href: '/sale' },
    { label: 'About Us', href: '/about' },
  ];

  const active = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      {/* Banner + header stick together on scroll */}
      <div
        className={`z-50 pwa-header ${
          isHome ? 'fixed top-0 left-0 right-0' : 'sticky top-0'
        }`}
      >
        <MarqueeBanner />
        <header className="transition-all duration-300 bg-brand-cream shadow-[0_6px_24px_-14px_rgba(61,43,33,0.12)]">
          <div className="safe-area-top bg-brand-cream" />
          <div className="border-b border-brand-brown/10">
            <nav aria-label="Main navigation" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div
                className={`relative flex items-center justify-between gap-3 transition-all duration-300 ${
                  overlayHeader ? 'h-[56px] sm:h-[64px]' : isScrolled ? 'h-[52px] sm:h-[56px]' : 'h-[56px] sm:h-[64px]'
                }`}
              >
              {/* ── Left: hamburger + logo ── */}
              <div className="flex items-center gap-1.5 min-w-0">
                <button
                  className="lg:hidden -ml-1 w-10 h-10 flex items-center justify-center rounded-full text-brand-brown hover:bg-brand-brown/10 transition-colors"
                  onClick={() => setIsMobileMenuOpen(true)}
                  aria-label="Open menu"
                >
                  <i className="ri-menu-3-line text-[22px]"></i>
                </button>

                <Link href="/" className="group flex items-center shrink-0" aria-label="Go to homepage">
                  <img
                    src="/logo.png"
                    alt={siteName}
                    className={`w-auto object-contain select-none transition-all duration-300 ${
                      overlayHeader ? 'h-7 sm:h-8' : isScrolled ? 'h-6 sm:h-7' : 'h-7 sm:h-8'
                    } group-hover:scale-[1.04]`}
                  />
                </Link>
              </div>

              {/* ── Center: nav (absolutely centered) ── */}
              <div className="hidden lg:flex items-center gap-8 xl:gap-10 absolute left-1/2 -translate-x-1/2">
                {desktopNavLinks.map((link) => {
                    const isActive = active(link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`group relative py-1 text-[11px] font-medium uppercase tracking-[0.18em] transition-colors duration-300 ${
                          isActive ? 'text-brand-brown' : 'text-brand-brown/70 hover:text-brand-brown'
                        }`}
                      >
                        {link.label}
                        <span
                          className={`pointer-events-none absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-[2px] rounded-full bg-brand-brown transition-all duration-300 ${
                            isActive ? 'w-5 opacity-100' : 'w-0 opacity-0 group-hover:w-5 group-hover:opacity-100'
                          }`}
                        />
                      </Link>
                    );
                  })}
              </div>

              {/* ── Right: actions ── */}
              <div className="flex items-center gap-0.5 sm:gap-1.5">
                {/* Search */}
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="w-10 h-10 flex items-center justify-center rounded-full text-brand-brown hover:bg-brand-brown/10 transition-colors"
                  aria-label="Search"
                >
                  <i className="ri-search-line text-[21px]"></i>
                </button>

                {/* Wishlist */}
                <Link
                  href="/wishlist"
                  className="relative w-10 h-10 hidden sm:flex items-center justify-center rounded-full text-brand-brown hover:bg-brand-brown/10 transition-colors"
                  aria-label={`Wishlist, ${wishlistCount} items`}
                >
                  <i className="ri-heart-line text-[21px]"></i>
                  {wishlistCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[15px] h-[15px] px-[3px] bg-brand-brown text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-brand-cream">
                      {wishlistCount}
                    </span>
                  )}
                </Link>

                {/* Account */}
                <Link
                  href={user ? '/account' : '/auth/login'}
                  className="w-10 h-10 hidden sm:flex items-center justify-center rounded-full text-brand-brown hover:bg-brand-brown/10 transition-colors"
                  aria-label={user ? 'My account' : 'Login'}
                >
                  <i className="ri-user-smile-line text-[21px]"></i>
                </Link>

                {/* Cart */}
                <div className="relative ml-0.5 sm:ml-1">
                  <button
                    className="relative w-10 h-10 flex items-center justify-center rounded-full text-brand-brown hover:bg-brand-brown/10 transition-colors"
                    onClick={() => setIsCartOpen(!isCartOpen)}
                    aria-label={`Shopping cart, ${cartCount} items`}
                    aria-expanded={isCartOpen}
                    aria-controls="mini-cart"
                  >
                    <i className="ri-shopping-bag-3-line text-[19px]"></i>
                    {cartCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-[3px] bg-brand-brown text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-brand-cream">
                        {cartCount}
                      </span>
                    )}
                  </button>
                  <MiniCart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
                </div>
              </div>
            </div>
          </nav>
        </div>
        </header>
      </div>

      {/* ── Search overlay ── */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-brand-brown/40 backdrop-blur-md" onClick={() => setIsSearchOpen(false)} />
          <div className="relative max-w-2xl mx-auto mt-[14vh] px-5 animate-in fade-in slide-in-from-top-6 duration-300">
            <form onSubmit={handleSearch} className="relative">
              <div className="bg-white rounded-[22px] shadow-2xl ring-1 ring-brand-carton/15 overflow-hidden">
                <div className="flex items-center px-5 gap-3">
                  <i className="ri-search-2-line text-brand-carton text-xl shrink-0"></i>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search bags, dresses, basics…"
                    className="flex-1 py-5 text-[16px] text-brand-brown bg-transparent outline-none placeholder-brand-brown/30"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setIsSearchOpen(false)}
                    className="shrink-0 text-[11px] font-semibold text-brand-brown/40 bg-brand-brown/5 px-2.5 py-1 rounded-md hover:bg-brand-brown/10 hover:text-brand-brown/60 transition-colors"
                  >
                    ESC
                  </button>
                </div>
                <div className="border-t border-brand-brown/[0.06] px-5 py-3.5 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-brown/30 mr-1">Popular</span>
                  {['New Arrivals', 'Dresses', 'Bags', 'Basics'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => { setSearchQuery(tag); }}
                      className="text-[12px] font-medium text-brand-brown/55 bg-brand-cream hover:bg-brand-carton/15 hover:text-brand-brown px-3 py-1.5 rounded-full transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Mobile menu ── */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[110] lg:hidden">
          <div
            className="absolute inset-0 bg-brand-brown/40 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          <div className="absolute inset-y-0 left-0 w-[86%] max-w-[370px] bg-brand-cream flex flex-col animate-in slide-in-from-left duration-300 shadow-2xl">
            {/* accent edge */}
            <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-brand-gold/0 via-brand-carton/30 to-brand-gold/0" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 h-[68px] shrink-0 border-b border-brand-brown/[0.06]">
              <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center">
                <img src="/logo.png" alt={siteName} className="h-10 w-auto object-contain" />
              </Link>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-9 h-9 flex items-center justify-center text-brand-brown/40 hover:text-brand-brown rounded-full hover:bg-brand-brown/5 transition-colors"
                aria-label="Close menu"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-4 pt-5 pb-6">
              {/* Main nav */}
              <div className="space-y-1 mb-6">
                {[{ label: 'Home', href: '/', icon: 'ri-home-5-line' }, ...navLinks.slice(1).map(l => ({
                  ...l,
                  icon: l.href === '/shop' ? 'ri-shopping-bag-3-line' : l.href === '/sale' ? 'ri-price-tag-3-line' : l.href === '/categories' ? 'ri-layout-grid-line' : l.href === '/about' ? 'ri-information-line' : 'ri-mail-send-line',
                }))].map((link, i) => {
                  const isActive = active(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-[15px] font-semibold transition-all animate-in slide-in-from-left-3 fade-in duration-300 fill-mode-both ${
                        isActive
                          ? 'bg-brand-brown text-white shadow-lg shadow-brand-brown/25'
                          : 'text-brand-brown/70 hover:bg-white hover:text-brand-brown hover:shadow-sm'
                      }`}
                      style={{ animationDelay: `${i * 45}ms` }}
                    >
                      <i className={`${link.icon} text-lg ${isActive ? 'text-brand-gold' : 'text-brand-brown/35'}`}></i>
                      {link.label}
                      {isActive && <i className="ri-arrow-right-s-line ml-auto text-white/70" />}
                    </Link>
                  );
                })}
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-brand-carton/25 to-transparent mx-2 mb-5" />

              {/* Quick links */}
              <p className="px-4 mb-2.5 text-[10px] font-bold tracking-[0.18em] uppercase text-brand-brown/30">Quick Links</p>
              <div className="space-y-0.5 mb-6">
                {[
                  { label: 'Track Order', href: '/order-tracking', icon: 'ri-truck-line' },
                  { label: 'Wishlist', href: '/wishlist', icon: 'ri-heart-3-line', badge: wishlistCount },
                  { label: user ? 'My Account' : 'Sign In', href: user ? '/account' : '/auth/login', icon: user ? 'ri-user-smile-line' : 'ri-user-4-line' },
                  { label: 'Help Center', href: '/faqs', icon: 'ri-question-line' },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-[14px] text-brand-brown/55 hover:text-brand-brown hover:bg-white transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <i className={`${link.icon} text-[17px] text-brand-brown/30`}></i>
                    <span className="flex-1">{link.label}</span>
                    {'badge' in link && link.badge! > 0 && (
                      <span className="text-[10px] font-bold text-white bg-brand-carton w-5 h-5 rounded-full flex items-center justify-center">{link.badge}</span>
                    )}
                  </Link>
                ))}
              </div>

              {/* Install CTA */}
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('show-pwa-install-guide'));
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-gradient-to-r from-brand-carton/15 to-brand-gold/10 text-[14px] font-semibold text-brand-brown hover:from-brand-carton/20 hover:to-brand-gold/15 transition-all"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-gold to-brand-carton flex items-center justify-center">
                  <i className="ri-smartphone-line text-base text-white"></i>
                </div>
                Install the App
              </button>
            </div>

            {/* Footer */}
            <div className="shrink-0 px-5 py-4 border-t border-brand-brown/[0.06]">
              <p className="text-[10px] text-brand-brown/30 font-medium">&copy; {new Date().getFullYear()} {siteName}. All rights reserved.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
