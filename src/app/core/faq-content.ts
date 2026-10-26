/** Editable FAQ copy. Keep answers accurate to how the business really works; update when policies change. */
import { FaqGroup } from './models';
export type { FaqGroup };

export const FAQ: FaqGroup[] = [
  {
    label: 'Getting started',
    items: [
      { q: 'What is A2 Craft Studio?', a: 'A small creative studio that makes invitations, memory books, scrapbooks, animated videos and personalized digital gifts. You can download ready-made designs instantly, personalize one with a live preview, or ask us to make something just for you.' },
      { q: 'Can I talk to someone on the phone?', a: 'Yes. We don’t publish a phone number. Instead, open the Contact page, choose “Request a call back” and leave your name and number. We’ll call you during our opening hours. Prefer to type? Chat with us on WhatsApp or send a message.' },
      { q: 'Do I need any design skills?', a: 'No. Pick a design, type your names and message, choose colours and a font, and upload photos if the design supports them. The preview updates as you type.' },
      { q: 'How long does it take?', a: 'Ready-made files are available the moment your payment is verified. Personalized print designs are checked and finished by us, and videos and custom gifts are made by hand. The expected turnaround is shown on each product page.' },
    ],
  },
  {
    label: 'Personalizing',
    items: [
      { q: 'Can I see my design before I pay?', a: 'For text and photo designs, yes: the studio shows a live layout preview. It is a guide, and we check and finish the final file by hand. Videos can’t be previewed automatically, so you share your details and we create it.' },
      { q: 'Which photos can I upload?', a: 'JPG, PNG or WebP, up to 5 MB each. Please only upload photos you have the right to use. They are used only to create your order and are stored privately.' },
      { q: 'Can I make changes after ordering?', a: 'Tell us as soon as possible. For personalized work we include a round of corrections as stated on your product page or quote. Large changes after production starts may cost extra.' },
    ],
  },
  {
    label: 'Orders & delivery',
    items: [
      { q: 'How will I receive my files?', a: 'Sign in and open Account → Downloads, or the link on your order page. Ready-made files unlock right after payment is verified. For personalized items we upload your final files and email you.' },
      { q: 'What if I can’t find my download?', a: 'Make sure you’re signed in with the email you used at checkout. Download links are private and short-lived, so just press Download again for a fresh one. Still stuck? Contact us with your order number.' },
      { q: 'Do I need an account to buy?', a: 'You can browse and save designs without one. Checkout needs an account so your downloads and order history stay safely in one place.' },
    ],
  },
  {
    label: 'Payments & refunds',
    items: [
      { q: 'How can I pay?', a: 'Payments are handled by Razorpay, which supports UPI, cards, netbanking and wallets. We never see or store your card details.' },
      { q: 'Can I get a refund?', a: 'Digital files can’t be returned, so refunds are limited. If a file is faulty or not as described, contact us within 7 days and we’ll fix or replace it, or refund you if we can’t. Personalized work can be cancelled before it starts. Read the full Refund & cancellation policy for details.' },
      { q: 'Where do I enter a coupon?', a: 'In your bag, before checkout. The discount is confirmed by our server, so what you see is what you pay.' },
    ],
  },
  {
    label: 'Licensing & privacy',
    items: [
      { q: 'Can I print or share my design?', a: 'Yes, for your own occasion. Most designs include a personal-use licence. Reselling or redistributing the files is not allowed. Products marked for commercial use may be used on your own business channels.' },
      { q: 'Is my information private?', a: 'Yes. Your details and photos are used only to fulfil your order and are never sold. See our Privacy policy for the full details.' },
    ],
  },
];
