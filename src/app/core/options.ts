/** Option lists used by forms and filters. These are choices, not business data. */
export const FORMAT_OPTIONS = ['PDF', 'PNG', 'JPG', 'MP4', 'ZIP', 'PSD'];

/** Suggestions for the occasion field (the shop also learns occasions from your own products). */
export const OCCASION_SUGGESTIONS = ['Birthday', 'Anniversary', 'Wedding', 'Valentine', 'Festival', 'Baby shower', 'Graduation', 'Any'];

/** One-click starting set for an empty shop. The owner can rename, reorder or delete any of them. */
export const SUGGESTED_CATEGORIES: { name: string; blurb: string; motif: import('./models').Motif }[] = [
  { name: 'Birthday gifts', blurb: 'Personal books and keepsakes for their day', motif: 'cake' },
  { name: 'Couple gifts', blurb: 'Little things that say “us”', motif: 'hearts' },
  { name: 'Anniversary', blurb: 'Celebrate every year together', motif: 'rings' },
  { name: 'Wedding invitations', blurb: 'Elegant suites for your big day', motif: 'frame' },
  { name: 'Birthday invitations', blurb: 'Party-ready invites', motif: 'cake' },
  { name: 'Digital scrapbooks', blurb: 'Layered memories, beautifully arranged', motif: 'frame' },
  { name: 'Memory books', blurb: 'Stories worth keeping', motif: 'book' },
  { name: 'Animated video invitations', blurb: 'Invites that move', motif: 'video' },
  { name: 'Instagram story templates', blurb: 'Scroll-stopping story layouts', motif: 'story' },
  { name: 'Printable cards', blurb: 'Print at home or at your local shop', motif: 'letter' },
  { name: 'Business & social media', blurb: 'Brand-ready templates', motif: 'story' },
  { name: 'Seasonal collections', blurb: 'Festive and limited-time designs', motif: 'lamp' },
];
