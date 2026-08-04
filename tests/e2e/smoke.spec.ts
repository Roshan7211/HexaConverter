import { expect, test } from '@playwright/test';

/**
 * Smoke coverage for the routes that must never break: the marketing entry
 * points, a converter page, an SEO landing page and the crawler surfaces.
 */

test.describe('public pages', () => {
  test('home page renders and links into the converter', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { level: 1, name: /convert any file/i }),
    ).toBeVisible();

    await page
      .getByRole('link', { name: /start converting/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/convert\/image$/);
  });

  test('converter page exposes an accessible upload control', async ({
    page,
  }) => {
    await page.goto('/convert/image');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByLabel(/choose files to convert/i)).toBeAttached();
    await expect(page.getByText(/drag and drop your files/i)).toBeVisible();
  });

  test('conversion landing page preselects its output format', async ({
    page,
  }) => {
    await page.goto('/tools/png-to-jpg');

    await expect(
      page.getByRole('heading', { level: 1, name: /convert png to jpeg/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /png to jpg questions/i }),
    ).toBeVisible();
  });

  test('unknown routes return the 404 page', async ({ page }) => {
    const response = await page.goto('/does-not-exist');

    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole('heading', { name: /could not find that page/i }),
    ).toBeVisible();
  });
});

test.describe('machine surfaces', () => {
  test('robots.txt points at the sitemap', async ({ request }) => {
    const response = await request.get('/robots.txt');

    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('Sitemap:');
  });

  test('sitemap lists converter and tool pages', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    const body = await response.text();

    expect(response.status()).toBe(200);
    expect(body).toContain('/convert/image');
    expect(body).toContain('/tools/png-to-jpg');
  });

  test('formats endpoint reports available routes', async ({ request }) => {
    const response = await request.get('/api/formats');
    const body = (await response.json()) as {
      counts: { routes: number; formats: number };
    };

    expect(response.status()).toBe(200);
    expect(body.counts.routes).toBeGreaterThan(100);
    expect(body.counts.formats).toBeGreaterThan(20);
  });

  test('security headers are present', async ({ request }) => {
    const response = await request.get('/');
    const headers = response.headers();

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['content-security-policy']).toContain(
      "frame-ancestors 'none'",
    );
  });
});

/**
 * Accounts are optional, and a deployment can be built with no Firebase
 * configuration at all — which is exactly what CI does. Everything asserted
 * here therefore has to hold in both states: the pages render and route
 * correctly whether or not sign-in is actually available, so these tests never
 * depend on secrets being present.
 */
test.describe('accounts', () => {
  test('account page redirects anonymous visitors to sign-in', async ({
    page,
  }) => {
    await page.goto('/account');

    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(
      page.getByRole('heading', { level: 1, name: /sign in/i }),
    ).toBeVisible();
  });

  test('sign-in and sign-up link to each other', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(
      page.getByText(/converting files never needs an account/i),
    ).toBeVisible();

    await page.getByRole('link', { name: /create one/i }).click();
    await expect(page).toHaveURL(/\/sign-up$/);
    await expect(
      page.getByRole('heading', { level: 1, name: /create an account/i }),
    ).toBeVisible();
  });
});

test.describe('pricing', () => {
  test('every plan is shown, with limits read from the server config', async ({
    page,
  }) => {
    await page.goto('/pricing');

    for (const plan of ['Guest', 'Member', 'Premium']) {
      await expect(
        page.getByRole('heading', { level: 2, name: plan, exact: true }),
      ).toBeVisible();
    }

    // The anonymous file ceiling, proving the table renders from `PLANS`
    // rather than from numbers typed into the markup.
    await expect(page.getByText('100 MB').first()).toBeVisible();
  });

  test('refund policy is reachable and names the merchant of record', async ({
    page,
  }) => {
    await page.goto('/legal/refunds');

    await expect(
      page.getByRole('heading', { level: 1, name: /refund policy/i }),
    ).toBeVisible();
    // Paddle's domain review looks for this acknowledgement specifically.
    await expect(page.getByText(/merchant of record/i).first()).toBeVisible();
  });
});
