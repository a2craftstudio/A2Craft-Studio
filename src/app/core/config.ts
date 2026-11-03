/** Single place to rebrand the site. */
export const BRAND = {
  name: 'A2 Craft Studio',
  shortName: 'A2',
  tagline: 'Digital keepsakes, made with love',
  description:
    'Invitation designs, animated videos, memory books, scrapbooks and personalized digital gifts, crafted by hand and delivered instantly.',
  instagramUrl: 'https://www.instagram.com/a2craft.studio',
  instagramHandle: '@a2craft.studio',
  youtubeUrl: 'https://www.youtube.com/@a2craft.studio',
  youtubeHandle: '@a2craft.studio',
  contactEmail: 'a2crafts.studio@gmail.com',
  whatsappUrl: '',
  siteUrl: 'https://example.com',
  currency: 'INR',
  locale: 'en-IN',
};

/** Opens Gmail's compose window in the browser, so it works even without a desktop mail app. */
export const gmailCompose = (to: string, subject = '', body = '') => {
  const q = (k: string, v: string) => (v ? `&${k}=${encodeURIComponent(v)}` : '');
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}${q('su', subject)}${q('body', body)}`;
};

/** Pre-written subject and message for visitors emailing the studio. */
export const ENQUIRY_SUBJECT = 'Enquiry from the A2 Craft Studio website';
export const ENQUIRY_BODY = 'Hi A2 Craft Studio team,\n\nI would like to know more about ';

export const PALETTES = [
  { id: 'blush', name: 'Blush', bg: '#F2DDE1', ink: '#71394E', accent: '#C78391' },
  { id: 'ivory', name: 'Ivory', bg: '#FFF9F5', ink: '#473633', accent: '#C78391' },
  { id: 'berry', name: 'Berry', bg: '#71394E', ink: '#FFF9F5', accent: '#F2DDE1' },
  { id: 'cocoa', name: 'Cocoa', bg: '#473633', ink: '#FFF9F5', accent: '#C78391' },
];

export const FONTS = [
  { id: 'sans', name: 'Clean sans', css: "'Figtree', system-ui, sans-serif" },
  { id: 'serif', name: 'Classic serif', css: "Georgia, 'Times New Roman', serif" },
  { id: 'script', name: 'Soft script', css: "'Dancing Script', cursive" },
];

/**
 * Legal and contact details used on the policy pages, footer and invoices.
 * Fill these in once. While any value still starts with "[", the legal pages show a reminder.
 */
export const BUSINESS = {
  legalName: '[Your registered business or proprietor name]',
  address: '[Full postal address, city, state, PIN]',
  gstin: '[GSTIN, or write "Not registered" if you are below the threshold]',
  supportEmail: 'a2crafts.studio@gmail.com',
  grievanceOfficer: '[Name of Grievance Officer]',
  grievanceEmail: '[grievance@your-domain.com]',
  responseHours: 48,
  resolveDays: 30,
  jurisdiction: '[City, State]',
};

export const BUSINESS_INCOMPLETE = Object.values(BUSINESS).some((v) => typeof v === 'string' && v.startsWith('['));
