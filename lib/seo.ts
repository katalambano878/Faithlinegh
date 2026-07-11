import type { Metadata } from 'next';

/**
 * Centralized, environment-driven SEO configuration and helpers.
 *
 * Everything (metadata + JSON-LD structured data) flows from here so the whole
 * site stays consistent and E-E-A-T friendly. Set NEXT_PUBLIC_APP_URL to your
 * live domain to make canonical URLs, Open Graph and structured data accurate.
 */

export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://faithlinegh.com').replace(/\/+$/, '');
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@faithlinegh.com';
export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'Faithlinegh';
export const SITE_LEGAL_NAME = SITE_NAME;
export const LOCALE = 'en_GH';
export const CONTACT_PHONE = process.env.NEXT_PUBLIC_CONTACT_PHONE || '+233541770961';

export const SITE_TAGLINE = 'Quality, Affordable Bags, Basics & Dresses in Ghana';
export const SITE_DESCRIPTION =
  'Faithlinegh is a Ghanaian fashion store for quality, affordable bags, basic tops and dresses for women — shop online with fast, nationwide delivery across Ghana.';

export const OG_IMAGE_PATH = '/og-image.png';
export const LOGO_PATH = '/logo.png';

export const SOCIAL_PROFILES = [
  'https://www.instagram.com/faithline.gh',
  'https://www.tiktok.com/@faithline.gh',
];

// Accra, Ghana
export const GEO = { latitude: 5.6037, longitude: -0.187 };

// Focus products — the keywords we want to dominate.
export const FOCUS_KEYWORDS = [
  'bags Ghana',
  'fashion bags Ghana',
  'affordable bags Accra',
  'women bags Ghana',
  'dresses Ghana',
  'affordable dresses Accra',
  'women dresses Ghana',
  'basic tops Ghana',
  'ladies basics',
  "women's fashion Ghana",
  'online clothing store Ghana',
  'online shopping Ghana',
  'Accra fashion',
  'fashion store Accra',
  'nationwide delivery Ghana',
];

export function absoluteUrl(path = ''): string {
  if (!path) return SITE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** Strip HTML and collapse whitespace for clean meta descriptions. */
export function toPlainText(html = '', maxLength = 160): string {
  const text = String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1).replace(/\s+\S*$/, '') + '…';
}

type PageMetaInput = {
  title?: string;
  description?: string;
  path?: string;
  images?: string[];
  keywords?: string[];
  type?: 'website' | 'article' | 'product' | 'profile';
  noindex?: boolean;
  publishedTime?: string;
  modifiedTime?: string;
};

/**
 * Build a complete Next.js Metadata object with canonical URL, Open Graph,
 * Twitter cards and robots directives. Use in server components / generateMetadata.
 */
export function pageMetadata({
  title,
  description = SITE_DESCRIPTION,
  path = '/',
  images,
  keywords = [],
  type = 'website',
  noindex = false,
  publishedTime,
  modifiedTime,
}: PageMetaInput = {}): Metadata {
  const canonical = absoluteUrl(path);
  const ogImages = (images && images.length ? images : [OG_IMAGE_PATH]).map((img) => absoluteUrl(img));
  const allKeywords = [...new Set([...keywords, ...FOCUS_KEYWORDS])];

  return {
    title,
    description,
    keywords: allKeywords,
    alternates: { canonical },
    openGraph: {
      title: title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} | ${SITE_TAGLINE}`,
      description,
      url: canonical,
      siteName: SITE_NAME,
      locale: LOCALE,
      type: type === 'product' ? 'website' : type,
      images: ogImages.map((url) => ({ url, width: 1200, height: 630, alt: title || SITE_NAME })),
      ...(publishedTime ? { publishedTime } : {}),
      ...(modifiedTime ? { modifiedTime } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} | ${SITE_TAGLINE}`,
      description,
      images: ogImages,
    },
    robots: noindex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-video-preview': -1,
            'max-snippet': -1,
          },
        },
  };
}

/* ───────────────────────── Structured data (JSON-LD) ───────────────────────── */

export const ORG_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const STORE_ID = `${SITE_URL}/#store`;

export function organizationSchema() {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE_NAME,
    legalName: SITE_LEGAL_NAME,
    url: SITE_URL,
    logo: { '@type': 'ImageObject', url: absoluteUrl(LOGO_PATH) },
    image: absoluteUrl(OG_IMAGE_PATH),
    description: SITE_DESCRIPTION,
    email: SUPPORT_EMAIL,
    foundingLocation: { '@type': 'Place', name: 'Accra, Ghana' },
    areaServed: { '@type': 'Country', name: 'Ghana' },
    knowsAbout: ['Women fashion bags', 'Dresses', 'Basic tops', 'Ladies fashion', 'Affordable fashion'],
    sameAs: SOCIAL_PROFILES,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      telephone: CONTACT_PHONE,
      areaServed: 'GH',
      availableLanguage: ['English'],
    },
  };
}

export function localBusinessSchema() {
  return {
    '@type': ['Store', 'ClothingStore'],
    '@id': STORE_ID,
    name: SITE_NAME,
    url: SITE_URL,
    image: absoluteUrl(OG_IMAGE_PATH),
    logo: absoluteUrl(LOGO_PATH),
    description: SITE_DESCRIPTION,
    telephone: CONTACT_PHONE,
    priceRange: '₵₵',
    currenciesAccepted: 'GHS',
    paymentAccepted: 'Mobile Money, Credit Card, Debit Card, Cash on Delivery',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Accra',
      addressRegion: 'Greater Accra',
      addressCountry: 'GH',
    },
    geo: { '@type': 'GeoCoordinates', latitude: GEO.latitude, longitude: GEO.longitude },
    areaServed: { '@type': 'Country', name: 'Ghana' },
    sameAs: SOCIAL_PROFILES,
    parentOrganization: { '@id': ORG_ID },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        opens: '09:00',
        closes: '18:00',
      },
    ],
  };
}

export function websiteSchema() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: 'en-GH',
    publisher: { '@id': ORG_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/shop?search={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

/** Combined site-wide @graph for the root layout. */
export function siteGraph() {
  return {
    '@context': 'https://schema.org',
    '@graph': [organizationSchema(), localBusinessSchema(), websiteSchema()],
  };
}

export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.url),
    })),
  };
}

export function faqSchema(items: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: toPlainText(item.answer, 5000) },
    })),
  };
}

export function articleSchema(article: {
  title: string;
  description: string;
  image?: string;
  url: string;
  datePublished?: string;
  dateModified?: string;
  author?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description: article.description,
    image: article.image ? absoluteUrl(article.image) : absoluteUrl(OG_IMAGE_PATH),
    mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(article.url) },
    url: absoluteUrl(article.url),
    ...(article.datePublished ? { datePublished: article.datePublished } : {}),
    ...(article.dateModified ? { dateModified: article.dateModified } : {}),
    author: { '@type': 'Organization', name: article.author || SITE_NAME, url: SITE_URL },
    publisher: { '@id': ORG_ID },
  };
}

type ProductForSchema = {
  name: string;
  description?: string;
  images?: string[];
  price: number;
  compareAtPrice?: number | null;
  currency?: string;
  sku?: string;
  inStock?: boolean;
  brand?: string;
  category?: string;
  rating?: number;
  reviewCount?: number;
  url: string;
};

export function productSchema(p: ProductForSchema) {
  const url = absoluteUrl(p.url);
  const images = (p.images && p.images.length ? p.images : [OG_IMAGE_PATH]).map((img) => absoluteUrl(img));
  const priceValidUntil = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString().split('T')[0];

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: toPlainText(p.description || `${p.name} — available at ${SITE_NAME}.`, 500),
    image: images,
    sku: p.sku || undefined,
    brand: { '@type': 'Brand', name: p.brand || SITE_NAME },
    ...(p.category ? { category: p.category } : {}),
    offers: {
      '@type': 'Offer',
      url,
      price: Number(p.price || 0).toFixed(2),
      priceCurrency: p.currency || 'GHS',
      priceValidUntil,
      availability: p.inStock === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@id': ORG_ID },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: { '@type': 'MonetaryAmount', value: '20', currency: 'GHS' },
        shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'GH' },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
          transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 5, unitCode: 'DAY' },
        },
      },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'GH',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 30,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/FreeReturn',
      },
    },
  };

  if (p.rating && p.reviewCount) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(p.rating).toFixed(1),
      reviewCount: p.reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return schema;
}

export function itemListSchema(items: { name: string; url: string }[], listName: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: listName,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: absoluteUrl(item.url),
      name: item.name,
    })),
  };
}

export function collectionPageSchema(opts: { name: string; description: string; url: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: opts.name,
    description: opts.description,
    url: absoluteUrl(opts.url),
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': ORG_ID },
  };
}

/** Tiny server-renderable JSON-LD <script>. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data);
}
