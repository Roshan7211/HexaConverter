import { expect, test } from '@playwright/test';

/**
 * Nothing may push the page sideways on a phone.
 *
 * A horizontal scrollbar on a narrow screen is the most common way a
 * content-heavy page becomes unusable, and it is invisible on a desktop
 * browser — which is why it survived four rounds of review here. The cause was
 * a single unbreakable token: the OOXML MIME types run to 73 characters, and a
 * grid item cannot shrink below its longest word, so every landing page
 * featuring DOCX, XLSX, PPTX, ODS or ODP overflowed a 320px screen by ~27px.
 *
 * 320 is the narrowest width still worth supporting; 360 is the breakpoint
 * where the ad units switch creative size.
 */

const WIDTHS = [320, 360, 390];

/** One page per template, chosen for the longest content each one can hold. */
const PAGES = [
  { path: '/', name: 'home' },
  { path: '/tools/docx-to-pdf', name: 'landing page with a long MIME type' },
  { path: '/tools/pptx-to-pdf', name: 'landing page with the longest MIME type' },
  { path: '/tools/png-to-jpg', name: 'landing page with the most notes' },
  { path: '/convert/document', name: 'category page' },
  { path: '/guides', name: 'guide index' },
  { path: '/guides/zip-vs-tar-gz-vs-7z', name: 'guide with the widest table' },
  { path: '/guides/why-csv-loses-leading-zeros-and-mangles-dates', name: 'guide with code spans' },
];

/**
 * Elements wider than the viewport are only a fault when nothing clips them.
 * The format marquee on the home page is deliberately several times the page
 * width inside an `overflow-hidden` strip, and that is not a defect.
 */
async function horizontalOverflow(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const offenders: string[] = [];

    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.right <= root.clientWidth + 1 && rect.left >= -1) continue;

      let parent = el.parentElement;
      let clipped = false;
      while (parent) {
        const overflowX = getComputedStyle(parent).overflowX;
        if (['auto', 'scroll', 'hidden', 'clip'].includes(overflowX)) {
          clipped = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (clipped) continue;

      const className = (el.className || '').toString().slice(0, 60);
      offenders.push(`<${el.tagName.toLowerCase()} class="${className}">`);
    }

    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      offenders: offenders.slice(0, 5),
    };
  });
}

for (const width of WIDTHS) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: 840 } });

    for (const { path, name } of PAGES) {
      test(`${name} does not scroll sideways`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState('networkidle');

        const result = await horizontalOverflow(page);

        expect(
          result.offenders,
          `elements escaping the viewport on ${path}`,
        ).toEqual([]);
        expect(
          result.scrollWidth,
          `${path} scrolls horizontally`,
        ).toBeLessThanOrEqual(result.clientWidth);
      });
    }
  });
}

test.describe('wide content stays inside its own column', () => {
  test.use({ viewport: { width: 390, height: 840 } });

  test('a guide table scrolls within its wrapper', async ({ page }) => {
    await page.goto('/guides/zip-vs-tar-gz-vs-7z');

    const table = page.locator('table').first();
    await table.scrollIntoViewIfNeeded();

    const measured = await table.evaluate((el) => {
      const wrapper = el.parentElement!;
      return {
        table: Math.round(el.getBoundingClientRect().width),
        wrapper: Math.round(wrapper.getBoundingClientRect().width),
        overflowX: getComputedStyle(wrapper).overflowX,
      };
    });

    // The table is genuinely wider than the phone; the wrapper is what makes
    // that acceptable, so assert both halves of the arrangement.
    expect(measured.table).toBeGreaterThan(measured.wrapper);
    expect(measured.overflowX).toBe('auto');
  });
});
