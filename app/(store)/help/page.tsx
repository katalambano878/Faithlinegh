import { redirect } from 'next/navigation';

// The old Help Centre was a template with made-up articles (gift cards,
// loyalty points, instalments) and fake view counts. The FAQ page holds the
// real answers, so /help sends shoppers there.
export default function HelpPage() {
  redirect('/faqs');
}
