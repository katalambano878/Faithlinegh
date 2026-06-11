# Customization Checklist

This codebase has been ownership-neutralized and then branded for **Faithlinegh**
(business name, Accra Ghana location, phone `0541770961`, Instagram & TikTok `faithline.gh`).
A few neutral placeholders remain (`example.com`, `support@example.com`) because no
domain/email was provided yet. Complete these steps to finish making the project yours.

## Identity
- [x] Brand name set to `Faithlinegh` (CMS defaults + `NEXT_PUBLIC_SITE_NAME`)
- [x] Contact phone / WhatsApp set to `0541770961` (Ghana, +233)
- [x] Social links set to Instagram & TikTok `faithline.gh` (shown in footer)
- [ ] Replace `example.com` / `https://example.com` with your domain (set `NEXT_PUBLIC_APP_URL`)
- [ ] Replace `support@example.com`, `admin@example.com`, `noreply@example.com` with your addresses
- [ ] Optionally manage contact info & socials live via the admin CMS (Settings)

## Assets (see `public/ASSETS_GUIDE.md`)
- [ ] Add `/public/favicon.ico` and `/public/favicon.png`
- [ ] Add `/public/apple-touch-icon.png`
- [ ] Add the PWA icons in `/public/icons/` (sizes listed in `manifest.json`)
- [ ] Add `/public/logo.png` and `/public/logo-white.png`
- [ ] Add `/public/og-image.png` and `/public/twitter-image.png` (1200×630px)
- [ ] Add `/public/hero-1.png`, `/public/hero-2.png` and `/public/wishlist.jpeg`
- [ ] Replace `/public/placeholder-product.svg` and the demo product data in
      `components/SmartRecommendations.tsx`, `components/CartSuggestions.tsx`,
      `components/AdvancedSearch.tsx`, `components/MobileSearchOverlay.tsx`

## Configuration
- [ ] Fill in all values in `.env.local` (copy from `.env.example`)
- [ ] Update `manifest.json` `name`, `short_name`, `theme_color`, `background_color`
- [ ] Update `package.json` `name`, and add `description` / `author` / `repository` if desired
- [ ] Set up your Supabase project and run the migrations in `supabase/`
- [ ] Set up your Moolre account and add API keys (MOOLRE_API_USER, MOOLRE_API_PUBKEY, MOOLRE_ACCOUNT_NUMBER)
- [ ] Set up your Resend account and add API key + from address
- [ ] Set up your Moolre (SMS) account if using SMS notifications
- [ ] Connect analytics (set `NEXT_PUBLIC_GA_MEASUREMENT_ID`)

## Legal
- [ ] Replace `/LICENSE` with your chosen license
- [ ] Review and complete `/app/(store)/privacy` with your privacy policy
- [ ] Review and complete `/app/(store)/terms` with your terms of service

## SEO
- [ ] Confirm `robots.txt` and `app/sitemap.ts` use your domain (driven by `NEXT_PUBLIC_APP_URL`)
- [ ] Update Open Graph / structured data in `app/layout.tsx` and `lib/seo.ts` (central SEO config: site name, URL, socials, geo, keywords, schema)
- [ ] Replace blog sample content in `app/(store)/blog/` and `app/admin/blog/`

## Deployment
- [ ] Configure your custom domain in your hosting platform
- [ ] Set all environment variables in your deployment platform
- [ ] Review `vercel.json` (cron schedule) if deploying to Vercel

## Notes on what was neutralized
- All previous brand names, domains, emails, phone numbers, social handles, chat/community
  links, and the third-party "Powered by" vendor credit were removed or replaced with
  neutral placeholders.
- All previous images, logos, favicons, PWA icons, OG/Twitter images, and brand
  documents were deleted from the repo.
- Development artifacts that could expose prior ownership (a dev chat log with VCS
  details, a prior debranding audit, the TypeScript build cache, and build logs) were deleted.
- Third-party demo image URLs were replaced with a local placeholder.
