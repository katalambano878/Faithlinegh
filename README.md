# Faithlinegh storefront

The online store for **Faithlinegh** (faithlinegh.com): quality, affordable bags, basic tops and dresses, with store pickup and delivery across Ghana. Product context and principles live in [PRODUCT.md](PRODUCT.md); branding details in [CUSTOMIZE.md](CUSTOMIZE.md).

## What's here

- **Store:** product pages with colour/size variants and bundle pricing, bag drawer, one-page checkout, order confirmation and tracking.
- **Payments:** Moolre (Mobile Money and card).
- **Admin:** products, orders, customers, coupons, staff permissions, POS.
- **Chat:** on-site AI assistant through OpenRouter (`OPENROUTER_API_KEY`). The WhatsApp assistant is a separate repo, `Drrbarns/faithline-whatsapp-ai`, which reads this store's database.
- **SMS:** Taysend, with Moolre as fallback.

## Stack and hosting

Next.js (App Router) with Supabase. Deployed with Coolify on coolify-vps (`faithlinegh-app`, domains faithlinegh.com and www.faithlinegh.com). Push to `main`, then check that Coolify queued a deploy; start a normal deploy if it didn't.

## Develop

```bash
npm install
npm run dev
```

Environment variables are in `.env.local` (not committed). Database setup notes: [SECURITY_RLS_SETUP.md](SECURITY_RLS_SETUP.md).

New orders get tracking codes starting `FL-`; older orders use `SLI-` and still track.
