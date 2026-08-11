import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/auth';

/**
 * Experimental rule-violation warning shown at submit time (BuildForm.tsx).
 * Non-blocking: the modal warns but still lets the user submit anyway.
 */
test.describe('Rule Violation Warning (experimental)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/create/manual');
    await page.waitForSelector('#buildName', { timeout: 10000 });
  });

  test('warns when picking Sacred Path without Nomadic + Spiritualist, and Submit Anyway still creates the build', async ({ page }) => {
    const buildName = `Rule Conflict Test ${Date.now()}`;

    await page.fill('#buildName', buildName);
    await page.fill('#buildDescription', 'Deliberately invalid combo for e2e test');
    await page.selectOption('#gameVersion', '4.4');
    await page.selectOption('#difficulty', 'balanced');

    await page.locator('select.form-select').nth(2).selectOption({ label: 'Humanoid' });

    // Sacred Path requires is_nomadic=true and (spiritualist or fanatic_spiritualist) ethic.
    // Leaving Nomadic off and picking a non-spiritualist ethic should trigger the warning.
    await page.waitForSelector('label[for="origin-origin_sacred_path"]', { timeout: 10000 });
    await page.locator('label[for="origin-origin_sacred_path"]').click();

    await page.waitForSelector('input[type="checkbox"][id^="ethic-"]', { timeout: 10000 });
    const materialistEthic = page.locator('input[type="checkbox"][id="ethic-ethic_materialist"]');
    await materialistEthic.scrollIntoViewIfNeeded();
    await materialistEthic.click();

    await page.waitForSelector('input[type="radio"][id^="authority-"]', { timeout: 10000 });
    const firstAuthority = page.locator('input[type="radio"][id^="authority-"]').first();
    await firstAuthority.scrollIntoViewIfNeeded();
    await firstAuthority.click();

    await page.waitForSelector('input[type="checkbox"][id^="civic-"]', { timeout: 10000 });
    const civics = page.locator('input[type="checkbox"][id^="civic-"]');
    await civics.nth(0).scrollIntoViewIfNeeded();
    await civics.nth(0).click();
    await civics.nth(1).scrollIntoViewIfNeeded();
    await civics.nth(1).click();

    await page.waitForSelector('input[type="checkbox"][id^="trait-"]', { timeout: 10000 });
    const validTrait = page.locator('input[type="checkbox"][id="trait-trait_nonadaptive"]');
    await validTrait.scrollIntoViewIfNeeded();
    await validTrait.click();

    const submitButton = page.locator('button:has-text("Submit Build")');
    await submitButton.scrollIntoViewIfNeeded();
    await submitButton.click();

    // Warning modal should appear instead of navigating away immediately.
    const modal = page.locator('.modal-content').filter({ hasText: 'Possible Rule Conflict' });
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal.locator('.badge', { hasText: 'Experimental' })).toBeVisible();

    // Submitting anyway should still create the build.
    await modal.locator('button:has-text("Submit Anyway")').click();
    await page.waitForURL('/', { timeout: 10000 });

    const buildCard = page.locator('.card').filter({ hasText: buildName });
    await expect(buildCard).toBeVisible({ timeout: 10000 });
  });
});
