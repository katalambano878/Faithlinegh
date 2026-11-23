/**
 * Site Knowledge Base — curated facts used by the AI chat assistant.
 */

export interface SiteKnowledgeEntry {
  id: string;
  title: string;
  path: string;
  category: string;
  content: string;
  keywords: string[];
}

export const SITE_KNOWLEDGE: SiteKnowledgeEntry[] = [
  {
    id: "business-overview",
    title: "About Faithlinegh",
    path: "/about",
    category: "company",
    content: `Faithlinegh is a Ghanaian fashion store offering quality, affordable bags, basics and dresses for women.

We curate stylish, everyday pieces — from basic tops and dresses to quality fashion bags — and make them easy to shop online with nationwide delivery across Ghana.

Vision: To make quality fashion accessible and affordable.
Mission: To deliver stylish, dependable pieces with great service, one order at a time.

Delivery: Nationwide delivery across Ghana.`,
    keywords: ["faithlinegh", "bags", "dresses", "basics", "tops", "women's fashion", "ghana", "accra", "about", "delivery"],
  },
  {
    id: "contact-info",
    title: "Contact Information",
    path: "/contact",
    category: "contact",
    content: `Contact Faithlinegh:

Phone/WhatsApp: 0541770961
Instagram: faithline.gh
TikTok: faithline.gh
Address: Accra, Ghana
Support Hours: Monday to Saturday, 9 AM - 6 PM`,
    keywords: ["contact", "phone", "whatsapp", "email", "address", "support", "instagram", "tiktok", "faithlinegh"],
  },
  {
    id: "shipping-policy",
    title: "Shipping & Delivery Policy",
    path: "/shipping",
    category: "shipping",
    content: `Delivery timeline:
- Accra & Greater Accra: delivered within 1–2 business days by our delivery riders.
- Other regions: 2–4 business days via courier services.
- Order pickup: customers can pick up their orders within 2 hours after payment confirmation.

Deliveries are available Monday to Saturday, excluding Sundays.

Delivery fees vary depending on location. The fee is communicated after the order has been placed and confirmed.

Please keep your phone reachable and make sure someone is available to receive the order. Missed deliveries may attract an additional delivery fee.

Customers can track orders using the order number and email.`,
    keywords: ["shipping", "delivery", "nationwide", "ghana", "timeline", "tracking", "pickup", "sunday", "business days", "fee", "missed"],
  },
  {
    id: "returns-policy",
    title: "Returns & Refunds Policy",
    path: "/returns",
    category: "returns",
    content: `All purchases are final. Faithline does not offer refunds or exchanges for change of mind, incorrect size selection or personal preference.

If an item is damaged, defective or incorrect due to an error on Faithline's part, contact us within 24 hours of delivery with the order details and clear photographs of the item. Keep the item unworn, unwashed and in its original condition while it is assessed. The team reviews it and contacts the customer with the appropriate resolution.

Exchanges or replacements are only considered when Faithline supplied an incorrect, damaged or defective item. Customers should check the size guide and ask for sizing help before ordering.

By completing a purchase, the customer agrees to the Returns & Exchanges Policy.`,
    keywords: ["returns", "refund", "exchange", "size", "worn", "condition", "24 hours", "damaged", "defective", "wrong item", "final"],
  },
  {
    id: "payment-methods",
    title: "Payment Methods",
    path: "/checkout",
    category: "payment",
    content: `Secure payments are processed by Moolre. Customers pay with Mobile Money (MTN, Telecel, AirtelTigo) or a Visa/Mastercard card at checkout.

Every order is paid in full when it is placed. There is no cash on delivery, no bank transfer and no instalment or part-payment option.
All prices are shown in ₵ (GHS, Ghana Cedis).`,
    keywords: ["payment", "moolre", "mobile money", "momo", "card", "checkout", "secure", "ghs", "cedis", "instalment", "installment", "cash on delivery", "bank transfer"],
  },
  {
    id: "order-tracking-guide",
    title: "How to Track Your Order",
    path: "/order-tracking",
    category: "orders",
    content: `To track an order, go to /order-tracking and provide your order number and email address.

Typical status flow:
Order Placed -> Payment -> Processing -> Packaged -> Dispatched -> Delivered.`,
    keywords: ["track", "order", "status", "order number", "email", "dispatched"],
  },
  {
    id: "faq-summary",
    title: "Frequently Asked Questions",
    path: "/faqs",
    category: "faq",
    content: `FAQs cover orders, shipping, returns, payment, and account support.

Customers can contact support via WhatsApp, email, or support ticket for unresolved issues.`,
    keywords: ["faq", "questions", "support", "orders", "shipping", "returns"],
  },
  {
    id: "legal-summary",
    title: "Privacy & Terms",
    path: "/privacy",
    category: "legal",
    content: `Privacy Policy and Terms explain data handling, order conditions, returns, and user responsibilities.

For legal questions, contact support@faithlinegh.com.`,
    keywords: ["privacy", "terms", "legal", "data", "policy"],
  },
  {
    id: "checkout-guide",
    title: "Checkout Process",
    path: "/checkout",
    category: "shopping",
    content: `Checkout steps:
1. Add products to cart
2. Enter shipping details
3. Choose delivery method
4. Complete payment
5. Receive confirmation and tracking updates`,
    keywords: ["checkout", "cart", "payment", "delivery", "order"],
  },
];

/**
 * Search the site knowledge base for relevant entries
 */
export function searchSiteKnowledge(query: string, maxResults = 3): SiteKnowledgeEntry[] {
  const lower = query.toLowerCase();
  const words = lower.split(/\s+/).filter(w => w.length > 2);

  const scored = SITE_KNOWLEDGE.map(entry => {
    let score = 0;

    // Exact keyword matches (highest priority)
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) score += 10;
      for (const word of words) {
        if (kw.includes(word) || word.includes(kw)) score += 3;
      }
    }

    // Title match
    if (entry.title.toLowerCase().includes(lower)) score += 15;
    for (const word of words) {
      if (entry.title.toLowerCase().includes(word)) score += 5;
    }

    // Content match
    const contentLower = entry.content.toLowerCase();
    for (const word of words) {
      if (contentLower.includes(word)) score += 2;
    }

    // Boost FAQ entries slightly (they cover common questions)
    if (entry.category === 'faq') score += 1;

    return { entry, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(s => s.entry);
}

/**
 * Get all knowledge entries for a specific category
 */
export function getKnowledgeByCategory(category: string): SiteKnowledgeEntry[] {
  return SITE_KNOWLEDGE.filter(e => e.category === category);
}

/**
 * Build a condensed site map for the system prompt
 */
export function getSiteMapSummary(): string {
  return `WEBSITE PAGES (you can reference these to help customers navigate):
- / — Homepage with featured products, categories, and store info
- /shop — Browse all products with filters (category, price, rating, sort)
- /categories — Shop by category
- /product/[slug] — Individual product pages with details, reviews, variants
- /cart — Shopping cart with coupon support
- /checkout — Checkout flow (shipping → delivery → payment)
- /order-tracking — Track orders by order number + email
- /returns — Returns & Exchanges policy, and report a damaged/incorrect item (within 24 hours of delivery)
- /account — Profile, order history, addresses, security settings
- /wishlist — Saved products
- /about — Faithlinegh story and mission
- /contact — Phone numbers, email, WhatsApp, visit info
- /faqs — 25+ frequently asked questions
- /help — Help center with 50+ articles across 6 categories
- /blog — Shopping tips, style guides, and fashion inspiration
- /shipping — Detailed shipping & delivery policy
- /privacy — Privacy policy
- /terms — Terms & conditions
- /support/ticket — Create a support ticket
- /support/tickets — View your tickets
- /auth/login — Sign in
- /auth/signup — Create account
- /auth/forgot-password — Reset password`;
}
