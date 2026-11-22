# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Shoppers in Ghana buying everyday fashion: tops, basics, dresses and bags. They arrive on both phones and desktop (confirmed by the owner, 2026-11-22), so every flow must work equally well on a small touch screen and a wide screen. Many come from social media and WhatsApp conversations about a specific item.

## Product Purpose

Faithlinegh is an online fashion store ("Effortless Style. Elevated Essentials.") selling quality, affordable bags, basics and dresses with delivery across Ghana. Success is a shopper going from a product they like to a paid order quickly, without confusion about size, colour, delivery cost or how to pay.

## Positioning

Curated, affordable essentials with bundle pricing that rewards buying several pieces (e.g. "3 for ₵300", mix colours and sizes), local Mobile Money payment, and fast delivery within Ghana.

## Operating Context

- Storefront built with Next.js; product, order and customer data in Supabase.
- Payment goes through Moolre: Mobile Money (MTN, Telecel, AirtelTigo) and card. The customer chooses MoMo or card on the Faithline checkout, then completes payment with Moolre.
- Delivery options: free store pickup, doorstep delivery within Accra, and delivery outside Accra. Fees per option are not yet confirmed and must not be invented in shipped UI.
- Guest checkout is allowed; account holders can save addresses.
- An on-site AI chat assistant and a WhatsApp AI agent answer product and order questions.
- Currency: Ghana cedi (₵, GHS). Ghana's 16 regions are used for addresses.

## Capabilities and Constraints

- Products have colour and size variants with per-variant stock and price, optional variant images, minimum order quantities, and bundle tiers.
- Coupons are entered at cart or checkout and validated against real coupons.
- Orders are created before payment; stock is reduced only when payment is confirmed.
- Unpaid orders get a payment-link reminder.
- Size guide exists for some categories.

## Brand Commitments

- Name: Faithline / Faithlinegh. Logo in `public/logo.png` and `public/logo-white.png`.
- Tagline: "Effortless Style. Elevated Essentials."
- Existing storefront look (owner chose to keep it for new work, 2026-11-22): espresso brown `#5B4436`, beige `#E6DFD5` header/footer, Playfair Display headings, Montserrat body.

## Evidence on Hand

- Real product photos and catalogue in Supabase; brand imagery in `public/` (hero, about, category images).
- Product ratings exist but most products have no reviews yet. Do not fabricate reviews, ratings, review counts or testimonials.
- Store policies shown on site: free shipping over ₵800, delivery within 48 hours, returns within 7 days.

## Product Principles

1. The fastest honest path from "I like this" to "paid": no step that does not help the customer decide or pay.
2. Show the money truthfully and early: unit price, bundle savings, delivery fee and total before the customer commits.
3. Ghana-first: phone number and Mobile Money are the primary identity and payment, not afterthoughts.
4. Equal care for phone and desktop.
