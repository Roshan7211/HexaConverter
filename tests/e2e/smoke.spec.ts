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

test.describe('authentication', () => {
  test('dashboard redirects anonymous visitors to sign-in', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/sign-in\?callbackUrl=/);
    await expect(
      page.getByRole('heading', { name: /welcome back/i }),
    ).toBeVisible();
  });

  test('sign-up form validates before submitting', async ({ page }) => {
    await page.goto('/sign-up');

    await page.getByLabel('Your name').fill('A');
    await page.getByLabel('Email address').fill('not-an-email');
    await page.getByLabel('Password').fill('short');
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByText(/enter your name/i)).toBeVisible();
  });
});
