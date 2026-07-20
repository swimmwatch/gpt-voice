import { expect, test } from '@playwright/test';

const documentationRoutes = ['', 'ru', 'be', 'uk', 'es', 'pt-br', 'zh-cn', 'ja', 'de', 'fr', 'hi'];
const pagesUrl = 'http://127.0.0.1:4175/gpt-voice/';

test('opens MkDocs from the landing page without path errors', async ({ page }) => {
  const landingResponse = await page.goto('./#faq');
  expect(landingResponse?.status()).toBe(200);

  const documentationLink = page.getByRole('link', { name: 'Documentation', exact: true }).first();
  await expect(documentationLink).toHaveAttribute('href', '/gpt-voice/docs/');
  await Promise.all([page.waitForURL(/\/gpt-voice\/docs\/$/u), documentationLink.click()]);

  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const landingLink = page.getByRole('link', { name: 'GPT-Voice Documentation', exact: true }).first();
  await expect(landingLink).toHaveAttribute('href', '/gpt-voice/');
  await Promise.all([page.waitForURL(/\/gpt-voice\/$/u), landingLink.click()]);

  await page.goBack();
  await page.goBack();
  await expect(page).toHaveURL(/\/gpt-voice\/#faq$/u);
  const firstQuestion = page.locator('#faq').getByRole('button').first();
  await firstQuestion.click();
  await expect(firstQuestion).toHaveAttribute('aria-expanded', 'true');
});

test('opens the documentation from the mobile no-JavaScript landing page', async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { height: 844, width: 390 },
  });
  const page = await context.newPage();

  try {
    const landingResponse = await page.goto(pagesUrl);
    expect(landingResponse?.status()).toBe(200);

    const documentationLink = page.locator('footer').getByRole('link', { name: 'Documentation', exact: true });
    await expect(documentationLink).toHaveAttribute('href', '/gpt-voice/docs/');
    await Promise.all([page.waitForURL(/\/gpt-voice\/docs\/$/u), documentationLink.click()]);
    await expect(page.getByRole('main')).toBeVisible();
  } finally {
    await context.close();
  }
});

for (const localeSlug of documentationRoutes) {
  test(`serves the ${localeSlug || 'English'} documentation root from the Pages artifact`, async ({ page }) => {
    const suffix = localeSlug ? `${localeSlug}/` : '';
    const response = await page.goto(`docs/${suffix}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('main')).toBeVisible();
  });
}
