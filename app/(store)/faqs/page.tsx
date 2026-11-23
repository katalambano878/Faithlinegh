"use client";

import { useState } from 'react';
import Link from 'next/link';
import JsonLd from '@/components/JsonLd';
import { faqSchema, breadcrumbSchema } from '@/lib/seo';

export default function FAQsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = [
    { id: 'all', name: 'All Questions', icon: 'ri-question-line' },
    { id: 'orders', name: 'Orders', icon: 'ri-shopping-bag-line' },
    { id: 'shipping', name: 'Shipping', icon: 'ri-truck-line' },
    { id: 'returns', name: 'Returns', icon: 'ri-arrow-go-back-line' },
    { id: 'payment', name: 'Payment', icon: 'ri-bank-card-line' },
    { id: 'account', name: 'Account', icon: 'ri-user-line' }
  ];

  const faqs = [
    {
      category: 'orders',
      question: 'How do I place an order?',
      answer: "Browse our product collections, add your selected items to cart, proceed to checkout, provide delivery details, choose payment, and confirm your order. You'll receive an order confirmation and updates."
    },
    {
      category: 'orders',
      question: 'Can I modify or cancel my order?',
      answer: "You can request changes within 1 hour of placing your order. Contact support immediately at support@faithlinegh.com. Once processing starts, changes may be limited."
    },
    {
      category: 'orders',
      question: 'How do I track my order?',
      answer: 'Visit our Order Tracking page and enter your order number (or tracking code) and email address to see your order status.'
    },
    {
      category: 'orders',
      question: 'What if I receive the wrong item?',
      answer: 'We\'re sorry if that happens. Contact us within 24 hours of delivery with your order details and clear photos of the item. Keep it unworn, unwashed and in its original condition while our team reviews it, and we\'ll contact you with the appropriate resolution.'
    },
    {
      category: 'shipping',
      question: 'What are your delivery times?',
      answer: 'Accra and Greater Accra: 1–2 business days, by our delivery riders. Other regions: 2–4 business days, by courier. Pickup orders can be collected within 2 hours after your payment is confirmed. Deliveries run Monday to Saturday (no Sundays).'
    },
    {
      category: 'shipping',
      question: 'How much does shipping cost?',
      answer: 'Store pickup is free. Delivery fees vary depending on your location: you pay for your items at checkout, and we tell you the delivery fee after your order has been placed and confirmed.'
    },
    {
      category: 'shipping',
      question: 'Where do you deliver?',
      answer: 'We deliver to your door in Accra, and anywhere else in Ghana through your nearest bus station (VIP, STC) or courier office. You can also collect from our store for free.'
    },
    {
      category: 'shipping',
      question: 'What if nobody is home for delivery?',
      answer: 'Please make sure your phone is reachable and someone is available to receive your order. Missed deliveries may attract an additional delivery fee.'
    },
    {
      category: 'shipping',
      question: 'How fast is delivery?',
      answer: 'Pickup orders are ready within 2 hours of payment. Delivery takes 1–2 business days in Accra and Greater Accra, and 2–4 business days to other regions.'
    },
    {
      category: 'returns',
      question: 'Can I return an item or get a refund?',
      answer: 'All purchases are final. We do not offer refunds for change of mind, incorrect size selection or personal preference. If an item is damaged, defective or incorrect due to an error on our part, we will review it and provide an appropriate resolution.'
    },
    {
      category: 'returns',
      question: 'How do I report a damaged or incorrect item?',
      answer: 'Contact us within 24 hours of delivery, or use the form on our Returns page. Include your order details and clear photographs of the item, and keep it unworn, unwashed and in its original condition while it is being assessed.'
    },
    {
      category: 'returns',
      question: 'Can I exchange an item for a different size?',
      answer: 'We do not offer exchanges for size-related issues, change of mind or personal preference. Please check our size guide and contact us for sizing help before you order. Exchanges or replacements are only considered when we have supplied an incorrect, damaged or defective item.'
    },
    {
      category: 'payment',
      question: 'What payment methods do you accept?',
      answer: 'We accept Mobile Money (MTN, Telecel and AirtelTigo) and Visa/Mastercard cards, paid securely through Moolre at checkout. Every order is paid in full when you place it. We do not take cash on delivery, bank transfers or instalments.'
    },
    {
      category: 'payment',
      question: 'Is it safe to use my credit card on your site?',
      answer: 'Absolutely. We use industry-standard SSL encryption and partner with trusted, secure payment processors. We never store your full card details on our servers. All transactions are PCI-DSS compliant.'
    },
    {
      category: 'payment',
      question: 'When will my payment be charged?',
      answer: 'You pay the full amount when you place your order. Your order is confirmed as soon as the payment comes through. If an item turns out to be unavailable, we contact you and refund you.'
    },
    {
      category: 'payment',
      question: 'How do refunds work?',
      answer: 'All purchases are final, so we do not refund change of mind, incorrect size selection or personal preference. If an item is damaged, defective or incorrect due to our error, our team reviews it and contacts you with the appropriate resolution.'
    },
    {
      category: 'account',
      question: 'Do I need an account to place an order?',
      answer: 'No, you can checkout as a guest. However, creating an account lets you track orders, save addresses, view purchase history, manage your wishlist, and receive exclusive offers. It only takes 30 seconds to sign up.'
    },
    {
      category: 'account',
      question: 'How do I reset my password?',
      answer: 'Click "Forgot Password" on the login page, enter your email address, and we\'ll send you a reset link. The link is valid for 1 hour. If you don\'t receive it, check your spam folder or contact support.'
    },
    {
      category: 'account',
      question: 'Can I have multiple delivery addresses?',
      answer: 'Yes! You can save multiple delivery addresses in your account. During checkout, simply select the address you want to use or add a new one. This is perfect for sending gifts or alternating between work and home.'
    },
    {
      category: 'account',
      question: 'How do I update my account information?',
      answer: 'Log in to your account and go to "Account Settings". You can update your name, email, phone number, password, and saved addresses. Changes are saved straight away.'
    }
  ];

  const filteredFAQs = faqs.filter(faq => {
    const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
    const matchesSearch = searchQuery === '' || 
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-white">
      <JsonLd
        data={[
          faqSchema(faqs.map((f) => ({ question: f.question, answer: f.answer }))),
          breadcrumbSchema([
            { name: 'Home', url: '/' },
            { name: 'FAQs', url: '/faqs' },
          ]),
        ]}
      />
      <div className="bg-gradient-to-br from-white via-white to-white/40 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              Frequently Asked Questions
            </h1>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Find quick answers to common questions about ordering, shipping, returns, and more.
            </p>

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for answers..."
                className="w-full pl-12 pr-4 py-4 border border-gray-300 rounded-full focus:ring-2 focus:ring-gray-600 focus:border-transparent text-sm shadow-lg"
              />
              <i className="ri-search-line absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl"></i>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-wrap gap-3 justify-center mb-12">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all whitespace-nowrap ${
                activeCategory === category.id
                  ? 'bg-gray-900 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <i className={`${category.icon} text-lg`}></i>
              {category.name}
            </button>
          ))}
        </div>

        {filteredFAQs.length > 0 ? (
          <div className="max-w-4xl mx-auto space-y-4">
            {filteredFAQs.map((faq, index) => (
              <details
                key={index}
                className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition-shadow"
              >
                <summary className="px-6 py-5 font-medium text-gray-900 cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-between">
                  <span className="flex-1 pr-4">{faq.question}</span>
                  <i className="ri-arrow-down-s-line text-xl text-gray-400"></i>
                </summary>
                <div className="px-6 pb-5 text-gray-600 leading-relaxed border-t border-gray-100 pt-4">
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-search-line text-4xl text-gray-400"></i>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No results found</h3>
            <p className="text-gray-600">
              Try adjusting your search or browse different categories
            </p>
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-gray-900 to-gray-900 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="ri-customer-service-2-line text-3xl text-white"></i>
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Still Have Questions?</h2>
          <p className="text-xl text-gray-100 mb-8 leading-relaxed">
            Our customer service team is ready to help. Contact us and we'll respond within 24 hours.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-white text-gray-900 px-8 py-4 rounded-full font-medium hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              <i className="ri-mail-line text-lg"></i>
              Contact Support
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Quick Links</h2>
          <p className="text-gray-600">Explore more helpful resources</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Link href="/shipping" className="bg-gray-50 p-8 rounded-2xl hover:shadow-lg transition-all cursor-pointer">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <i className="ri-truck-line text-2xl text-gray-900"></i>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Shipping Policy</h3>
            <p className="text-gray-600 leading-relaxed">
              Learn about delivery times, costs, and tracking your orders
            </p>
          </Link>

          <Link href="/returns" className="bg-gray-50 p-8 rounded-2xl hover:shadow-lg transition-all cursor-pointer">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <i className="ri-arrow-go-back-line text-2xl text-gray-900"></i>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Delivery Info</h3>
            <p className="text-gray-600 leading-relaxed">
              Learn about our nationwide delivery options.
            </p>
          </Link>

          <Link href="/privacy" className="bg-gray-50 p-8 rounded-2xl hover:shadow-lg transition-all cursor-pointer">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <i className="ri-shield-check-line text-2xl text-gray-900"></i>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Privacy & Security</h3>
            <p className="text-gray-600 leading-relaxed">
              See how we protect your personal information and data
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
