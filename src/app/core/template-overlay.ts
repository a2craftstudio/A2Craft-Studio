/**
 * A customer's edits to a template, kept apart from the template itself: slot ids come
 * from public/template-bridge.js, which reads the page and rewrites those slots on request.
 * The template files are never modified — the overlay travels with the order instead.
 */
export interface TemplateOverlay {
  /** Text slot id -> replacement wording. */
  text: Record<string, string>;
  /** Image slot id -> replacement source (an https URL or a data: URL). */
  images: Record<string, string>;
}

/** A text slot the bridge found in the page, in descending font-size order. */
export interface TextSlot {
  id: string;
  text: string;
  tag: string;
  size: number;
  role: 'names' | 'date' | 'venue' | 'heading' | 'text';
}

export interface ImageSlot {
  id: string;
  kind: 'img' | 'background';
  src: string;
}

export const emptyOverlay = (): TemplateOverlay => ({ text: {}, images: {} });

export const overlayIsEmpty = (o: TemplateOverlay) =>
  Object.keys(o.text).length === 0 && Object.keys(o.images).length === 0;

const key = (slug: string) => 'a2.template.' + slug;

export function loadOverlay(slug: string): TemplateOverlay {
  try {
    const raw = localStorage.getItem(key(slug));
    if (!raw) return emptyOverlay();
    const parsed = JSON.parse(raw) as Partial<TemplateOverlay>;
    return { text: parsed.text ?? {}, images: parsed.images ?? {} };
  } catch {
    return emptyOverlay();
  }
}

/** Returns false when the draft is too large for storage, which photos make likely. */
export function saveOverlay(slug: string, o: TemplateOverlay): boolean {
  try {
    localStorage.setItem(key(slug), JSON.stringify(o));
    return true;
  } catch {
    return false;
  }
}

export function clearOverlay(slug: string) {
  try {
    localStorage.removeItem(key(slug));
  } catch {
    /* nothing stored */
  }
}

/**
 * The handful of slots worth putting at the top of the editor: the couple's names, the
 * date and the venue, picked by the role the bridge guessed, then the largest headings.
 */
export function highlightSlots(slots: TextSlot[]): { label: string; slot: TextSlot }[] {
  const out: { label: string; slot: TextSlot }[] = [];
  const take = (role: TextSlot['role'], label: string) => {
    const s = slots.find((x) => x.role === role && !out.some((o) => o.slot.id === x.id));
    if (s) out.push({ label, slot: s });
  };
  take('names', 'Names');
  take('date', 'Date');
  take('venue', 'Venue');
  for (const s of slots) {
    if (out.length >= 6) break;
    if (s.role === 'heading' && !out.some((o) => o.slot.id === s.id)) out.push({ label: 'Heading', slot: s });
  }
  return out;
}
