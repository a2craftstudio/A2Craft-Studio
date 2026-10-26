import { BRAND } from './config';
import { ContentSection } from './models';

/**
 * Editable page copy. Tokens like {legalName} are filled from BUSINESS in config.ts.
 * These are well-structured TEMPLATES, not legal advice: have a qualified professional review them against your
 * real practices and Indian law (IT Act 2000, Consumer Protection Act 2019 and E-Commerce Rules 2020, DPDP Act 2023, GST) before launch.
 */
export interface LegalDoc {
  title: string;
  description: string;
  updated: string;
  sections: { h: string; p: string[] }[];
}

const UPDATED = '26 October 2026';

const RAW: Record<string, LegalDoc> = {
  about: {
    title: 'About us',
    description: 'The story behind the studio.',
    updated: UPDATED,
    sections: [
      { h: 'Hello, we’re {brand}', p: ['[Replace with your story: who you are, why you started, and what you love making.]', 'We design invitations, memory books, scrapbooks, animated videos and personalized digital gifts, crafted by hand and delivered digitally.'] },
      { h: 'How we work', p: ['Ready-made designs are delivered as digital files the moment payment is verified. Personalized and video products are prepared by hand after you share your details, so please allow the turnaround listed on each product.'] },
      { h: 'Who is behind the shop', p: ['{legalName}, {address}.', 'Questions? Email {supportEmail}.'] },
    ],
  },

  privacy: {
    title: 'Privacy policy',
    description: 'What we collect, why, who sees it and how to control it.',
    updated: UPDATED,
    sections: [
      { h: 'Who we are', p: ['{legalName} ("{brand}", "we") operates this website. For privacy questions, write to {supportEmail} or our Grievance Officer (see the Grievance page).'] },
      { h: 'What we collect', p: [
        'Account details: your name and email, and a password handled by our authentication provider (we never see or store your password).',
        'Orders: items, amounts, coupon used, and the personalization you submit (names, dates, messages, notes, photos).',
        'Custom-order requests and contact messages, including any reference images you upload.',
        'Call-back requests: the name and phone number you give us if you ask us to call you. We show no phone number on the site; your number is used only to call you back about your request, is visible only to our team, and is deleted after 90 days.',
        'Newsletter: your email and the date you consented, only if you opt in.',
        'Saved designs (favourites) and your cart. If you are signed out these are kept only in your browser.',
        'Visit analytics, only if you allow it: the pages and designs you view and when, with a random visitor ID, linked to your account if you are signed in. Used to understand which designs are popular and to improve the site. Kept for up to 90 days, then deleted. Checkout, order and admin pages are never recorded.',
        'We do not collect or store card, UPI or bank details. They go directly to our payment provider.',
      ] },
      { h: 'Why we use it (and our basis)', p: [
        'To create your account, take payment, make and deliver your order and provide support (to perform our contract with you).',
        'To send order confirmations and delivery updates (to perform our contract).',
        'To send our newsletter, only with your consent. You can withdraw it at any time using the unsubscribe link or by emailing us.',
        'To prevent fraud and abuse, and to meet legal and tax obligations.',
      ] },
      { h: 'Who we share it with', p: [
        'Service providers that process data for us, only as needed: Razorpay (payments), our email provider, and our hosting provider. Fonts are loaded from Google Fonts.',
        'We do not sell your personal data. We disclose information when the law requires it.',
      ] },
      { h: 'Photos and files you upload', p: ['Photos are stored privately and used only to make your order or answer your request. They are not shown publicly and are not used for marketing without your separate written permission.'] },
      { h: 'How long we keep it', p: [
        'Order and invoice records: as required by tax and accounting law (generally up to 8 years).',
        'Uploaded photos and custom-order files: [state your period, e.g. 12 months after delivery], then deleted.',
        'Account data: until you ask us to delete your account. Newsletter: until you unsubscribe.',
      ] },
      { h: 'Your rights', p: [
        'You can ask to access, correct, download or delete your personal data, withdraw consent, and raise a complaint. Signed-in customers can send a data request from Account → Profile, or email {supportEmail}.',
        'Deleting data that we must keep by law (such as invoices) may be refused until the legal period ends. We respond within 30 days. If you are unhappy, contact our Grievance Officer; you may also approach the Data Protection Board of India once it is operational.',
      ] },
      { h: 'Security', p: ['Data is encrypted in transit. Access to orders, files and admin tools is restricted by database security rules, and downloads use short-lived private links. No online service can promise absolute security.'] },
      { h: 'Children', p: ['Our shop is for adults. We do not knowingly collect personal data from children under 18 without a parent or guardian’s consent. Contact us if you believe a child has given us data.'] },
      { h: 'Changes', p: ['We will update this page when our practices change and show the date at the top. If a change is significant we will tell account holders by email.'] },
    ],
  },

  terms: {
    title: 'Terms of service',
    description: 'The terms that apply when you use the site and buy from us.',
    updated: UPDATED,
    sections: [
      { h: 'Agreement', p: ['By using this site or placing an order you agree to these terms, our Privacy, Refund & Cancellation, Digital Delivery and Licensing policies. If you do not agree, please do not use the site.'] },
      { h: 'Who we are', p: ['{legalName}, {address}. GSTIN: {gstin}. Email: {supportEmail}. To talk to us, use the call-back form on the Contact page.'] },
      { h: 'Accounts', p: ['Keep your login details safe; you are responsible for activity on your account. Provide accurate information. We may suspend accounts used for fraud or abuse.'] },
      { h: 'Products and prices', p: [
        'All prices are in Indian Rupees and include applicable taxes unless stated. Prices and discounts are confirmed by our server at checkout; if a price was shown in error we may cancel the order and refund you in full.',
        'Digital products are licensed, not sold; see the Licensing page. Product images and previews are illustrative; personalized results may differ slightly from previews.',
      ] },
      { h: 'Orders and payment', p: ['An order is accepted when your payment is verified. Payments are processed by Razorpay. We do not store your payment details. Downloads are enabled only after verified payment.'] },
      { h: 'Your content', p: [
        'When you upload photos or text you confirm that you own them or have permission to use them, and that they are lawful and do not infringe anyone’s rights, are not obscene, defamatory or hateful, and do not show minors in an inappropriate way.',
        'You keep your rights. You give us permission to use your content solely to create and deliver your order. We may refuse content that breaks these rules.',
      ] },
      { h: 'Acceptable use', p: ['Do not copy, resell or redistribute our designs or files; scrape the site; attempt to bypass payment or download controls; upload malware; or misuse the site in any unlawful way.'] },
      { h: 'Intellectual property', p: ['Designs, templates, text, logos and site code belong to {legalName} or its licensors. See the Licensing page for what you may do with purchased files. Report suspected infringement through the Copyright & takedown page.'] },
      { h: 'Custom work', p: ['Custom orders follow the separate Custom order terms.'] },
      { h: 'Liability', p: [
        'We provide the site and files with reasonable care but cannot guarantee uninterrupted or error-free service. To the extent permitted by law, our total liability for any claim relating to an order is limited to the amount you paid for that order. Nothing here limits rights you have under Indian consumer law.',
      ] },
      { h: 'Disputes', p: ['These terms are governed by the laws of India. Courts at {jurisdiction} have jurisdiction, subject to your consumer rights. Please contact us first at {supportEmail}; we aim to resolve issues quickly. See the Grievance page for the formal process.'] },
      { h: 'Changes', p: ['We may update these terms; the date above shows the latest version. Orders are governed by the terms in force when you placed them.'] },
    ],
  },

  delivery: {
    title: 'Digital product delivery',
    description: 'How and when you receive your files.',
    updated: UPDATED,
    sections: [
      { h: 'No physical shipping', p: ['Everything we sell is digital. Nothing is posted to you and there are no shipping charges.'] },
      { h: 'Ready-made designs', p: ['Files unlock in your account (Account → Downloads, or your order page) as soon as payment is verified, usually within a minute.'] },
      { h: 'Personalized and custom items', p: [
        'These are prepared by hand after payment. The expected turnaround is shown on each product or in your quote (typically 1–5 working days). We email you when your files are ready and they appear on your order page.',
        'Turnaround begins once we have everything we need from you (names, dates, photos). Delays in sending details move the delivery date.',
      ] },
      { h: 'Download links', p: ['Links are private and short-lived. If one expires, sign in and press Download again for a fresh one. Please save your files after downloading.'] },
      { h: 'Problems', p: ['If your payment succeeded but nothing unlocked, or a file will not open, write to {supportEmail} with your order number. Do not pay twice; if you are charged more than once, the extra amount is refunded.'] },
    ],
  },

  refunds: {
    title: 'Refund & cancellation policy',
    description: 'When refunds and cancellations are possible.',
    updated: UPDATED,
    sections: [
      { h: 'Ready-made digital files', p: ['Digital files cannot be returned once delivered, so we generally do not refund them. If a file is faulty, corrupt or materially not as described, contact us within 7 days of purchase with your order number and we will fix or replace it, or refund you if we cannot.'] },
      { h: 'Personalized and custom work', p: [
        'You may cancel for a full refund before we start work. Once work has started, we may keep a fair portion for the work completed, which we will tell you before deducting.',
        'Each personalized order includes the revisions stated on the product page or quote. Mistakes in details you supplied are not grounds for a refund, but we will help correct them within the included revisions.',
      ] },
      { h: 'Failed, duplicate or incorrect charges', p: ['If you are charged but your order fails, or charged more than once, the extra amount is refunded in full to your original payment method.'] },
      { h: 'How refunds are processed', p: ['Approved refunds are issued to the original payment method within [state your timeframe, e.g. 5–7 working days] of approval. Your bank may take additional time to show it.'] },
      { h: 'How to ask', p: ['Email {supportEmail} with your order number and a short description. We reply within {responseHours} hours. These terms do not affect your statutory rights as a consumer.'] },
    ],
  },

  licensing: {
    title: 'Licensing & usage rights',
    description: 'What you can and can’t do with our designs.',
    updated: UPDATED,
    sections: [
      { h: 'Personal licence (default)', p: ['You may print, share and display the design for your own occasion (for example your wedding or your child’s birthday), including sending invitations to your guests. You may not resell, share the source files, put them on file-sharing or template sites, or claim the design as your own.'] },
      { h: 'Commercial licence', p: ['Products marked for commercial use may be used for one business or brand’s own social media and marketing. You may not resell or give away the templates themselves, or use them in products you sell as templates.'] },
      { h: 'Your content', p: ['You keep the rights to your photos and text. You give us permission to use them only to create your order.'] },
      { h: 'Fonts and elements', p: ['Fonts and graphic elements inside your files are included for use within the finished design only.'] },
      { h: 'Breaking the licence', p: ['If you break these terms we may withdraw your licence and access to downloads without refund.'] },
    ],
  },

  'custom-terms': {
    title: 'Custom order terms',
    description: 'How custom gifts, videos and designs work.',
    updated: UPDATED,
    sections: [
      { h: 'Quote and approval', p: ['After you send a request we reply with a price, scope and timeline. Work starts once you approve the quote and payment is verified.'] },
      { h: 'What we need from you', p: ['Accurate names, dates and text, and photos you have the right to use. Please check spelling carefully; we work from what you send.'] },
      { h: 'Revisions', p: ['Your quote states how many revision rounds are included. Extra changes or new directions may be charged.'] },
      { h: 'Deadlines and rush work', p: ['Tell us your deadline when you enquire. We will confirm whether we can meet it; rush work may cost extra. Delays in receiving your details move the delivery date.'] },
      { h: 'Delivery', p: ['Final files are uploaded to your order and we email you. Videos are delivered as downloadable files.'] },
      { h: 'Cancellation, refunds and rights', p: ['See the Refund & cancellation policy. We may show finished work in our portfolio only with your written permission.'] },
    ],
  },

  cookies: {
    title: 'Cookies & browser storage',
    description: 'What this site stores on your device.',
    updated: UPDATED,
    sections: [
      { h: 'What we use', p: [
        'We use browser storage that is essential for the site to work: keeping you signed in, remembering your bag, favourites, the designs you recently viewed (a short history that stays on your device and that you can clear on the home page), any customization draft you saved, and whether you have seen the welcome tour or this notice.',
        'We do not use advertising cookies or third-party trackers. With your permission only, we run simple first-party visit analytics: we record which pages and designs you view, with a random visitor ID kept on your device, and your account email if you are signed in. You choose when the notice first appears, and can change it any time via "Privacy choices" in the footer or in your account. If you decline, nothing is recorded.',
      ] },
      { h: 'Third parties', p: ['Fonts are loaded from Google Fonts, and payment pages are provided by Razorpay when you pay. They may set their own cookies under their own policies.'] },
      { h: 'Your choices', p: ['You can clear site data in your browser settings at any time. Doing so will sign you out and empty your bag.'] },
    ],
  },

  grievance: {
    title: 'Grievance redressal',
    description: 'How to raise a complaint and what to expect.',
    updated: UPDATED,
    sections: [
      { h: 'Grievance Officer', p: ['Name: {grievanceOfficer}', 'Email: {grievanceEmail}', 'Address: {legalName}, {address}', 'We acknowledge complaints within {responseHours} hours and aim to resolve them within {resolveDays} days of receipt, as required by the Consumer Protection (E-Commerce) Rules, 2020.'] },
      { h: 'How to complain', p: ['Email the Grievance Officer with your name, order number (if any) and what went wrong. Please try our support email first for everyday questions: {supportEmail}.'] },
      { h: 'If you remain unhappy', p: ['You may contact the National Consumer Helpline (1915 or consumerhelpline.gov.in) or your consumer commission.'] },
    ],
  },

  takedown: {
    title: 'Copyright & takedown',
    description: 'How to report content that infringes your rights.',
    updated: UPDATED,
    sections: [
      { h: 'Reporting infringement', p: ['If you believe content on this site infringes your copyright or other rights, email {grievanceEmail} with: your name and contact details; a description of your work and where it appears on our site; a statement that you are the owner or authorised to act for them; and your signature (typed is fine).'] },
      { h: 'What we do', p: ['We review reports promptly, may remove content while we investigate, and will contact the person who supplied the content. Repeat infringers may be removed from the site.'] },
    ],
  },

  accessibility: {
    title: 'Accessibility',
    description: 'Our commitment to an inclusive site.',
    updated: UPDATED,
    sections: [
      { h: 'Our approach', p: ['We aim to make this site usable by everyone: semantic page structure, keyboard navigation, visible focus, text alternatives for images, readable contrast, and reduced motion for visitors who ask for it.'] },
      { h: 'Known gaps', p: ['Some demonstration images and the live design preview may not yet be fully described for screen readers. We are working on it.'] },
      { h: 'Tell us', p: ['If you have trouble using any part of the site, email {supportEmail} and we will help you complete your order another way and fix the issue.'] },
    ],
  },
};

export type Tokens = Record<string, string | number>;

/** Fills {tokens} from the business details (and the brand name). Unknown tokens are left as they are. */
export function fill(text: string, tokens: Tokens): string {
  const map: Tokens = { ...tokens, brand: BRAND.name };
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in map ? String(map[k]) : m));
}

/** Builds every policy page with the owner's business details filled in; the About sections can be overridden. */
export function buildPages(tokens: Tokens, aboutOverride?: ContentSection[]): Record<string, LegalDoc> {
  return Object.fromEntries(
    Object.entries(RAW).map(([slug, d]) => {
      const sections = slug === 'about' && aboutOverride?.length ? aboutOverride : d.sections;
      return [slug, { ...d, sections: sections.map((s) => ({ h: fill(s.h, tokens), p: s.p.map((x) => fill(x, tokens)) })) }];
    }),
  );
}

export const LEGAL_SLUGS = Object.keys(RAW);

/** Pages shown in the footer "Policies" column, in order. */
export const POLICY_LINKS: { slug: string; label: string }[] = [
  { slug: 'terms', label: 'Terms of service' },
  { slug: 'privacy', label: 'Privacy policy' },
  { slug: 'refunds', label: 'Refunds & cancellation' },
  { slug: 'delivery', label: 'Digital delivery' },
  { slug: 'licensing', label: 'Licensing' },
  { slug: 'custom-terms', label: 'Custom order terms' },
  { slug: 'cookies', label: 'Cookies & storage' },
  { slug: 'grievance', label: 'Grievance officer' },
  { slug: 'takedown', label: 'Copyright & takedown' },
  { slug: 'accessibility', label: 'Accessibility' },
];
