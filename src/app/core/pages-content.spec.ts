import { buildPages, fill, LEGAL_SLUGS, POLICY_LINKS } from './pages-content';

const BIZ = {
  legalName: 'Test Studio', address: '1 Test Road, Pune', gstin: '27ABCDE1234F1Z5', supportEmail: 'help@test.example',
  grievanceOfficer: 'A. Officer', grievanceEmail: 'grievance@test.example', jurisdiction: 'Pune, Maharashtra', responseHours: 48, resolveDays: 30,
};

describe('policy pages', () => {
  const pages = buildPages(BIZ);

  it('every footer policy link has a page', () => {
    for (const l of POLICY_LINKS) expect(pages[l.slug]).withContext(l.slug).toBeDefined();
  });

  it('has every page a title, date and content, with all {tokens} filled', () => {
    for (const slug of LEGAL_SLUGS) {
      const d = pages[slug];
      expect(d.title).withContext(slug).toBeTruthy();
      expect(d.updated).toBeTruthy();
      expect(d.sections.length).withContext(slug).toBeGreaterThan(0);
      const all = d.sections.flatMap((s) => [s.h, ...s.p]).join(' ');
      expect(/\{\w+\}/.test(all)).withContext(slug + ' has an unfilled token').toBeFalse();
    }
  });

  it('covers the pages an Indian online shop needs', () => {
    for (const s of ['terms', 'privacy', 'refunds', 'delivery', 'licensing', 'grievance', 'cookies']) expect(LEGAL_SLUGS).toContain(s);
  });

  it('puts the owner’s business details into the policies', () => {
    const text = pages['grievance'].sections.flatMap((s) => s.p).join(' ');
    expect(text).toContain('A. Officer');
    expect(text).toContain('grievance@test.example');
    expect(pages['terms'].sections.flatMap((s) => s.p).join(' ')).toContain('27ABCDE1234F1Z5');
  });

  it('lets the owner replace the About sections', () => {
    const custom = buildPages(BIZ, [{ h: 'Our story', p: ['We began in {legalName}.'] }]);
    expect(custom['about'].sections[0].h).toBe('Our story');
    expect(custom['about'].sections[0].p[0]).toBe('We began in Test Studio.');
  });

  it('leaves unknown tokens alone', () => {
    expect(fill('Mail {supportEmail} {unknown}', BIZ)).toBe('Mail help@test.example {unknown}');
  });
});
