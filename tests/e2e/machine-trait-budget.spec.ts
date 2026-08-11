import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/auth';

/**
 * MACHINE archetype gets a smaller trait point budget (1) than the default
 * BIOLOGICAL budget (2) - see data-extractor/extract_species_archetypes.py.
 * BuildForm.tsx used to hardcode 2 points for every archetype; this checks
 * the live UI now reflects the correct per-archetype budget.
 */
test.describe('Trait budget by species archetype', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/create/manual');
    await page.waitForSelector('#buildName', { timeout: 10000 });
    await page.selectOption('#gameVersion', '4.4');
    await page.locator('select.form-select').nth(2).selectOption({ label: 'Machine' });
  });

  test('shows 1 trait point base limit for Machine, and disables submit past it', async ({ page }) => {
    await page.waitForSelector('input[type="checkbox"][id^="trait-"]', { timeout: 10000 });

    // Two cost-1 traits (not mutual opposites) - 2 points total, which would
    // have been within the old flat 2-point budget but exceeds MACHINE's real
    // 1-point budget.
    const trait1 = page.locator('input[type="checkbox"][id="trait-trait_robot_double_jointed"]');
    const trait2 = page.locator('input[type="checkbox"][id="trait-trait_robot_durable"]');
    await trait1.scrollIntoViewIfNeeded();
    await trait1.click();

    // Base limit shown should be 1, not the old hardcoded 2, once a
    // trait-granting bonus panel or the points label reflects the archetype.
    await expect(page.locator('text=/Species Traits \\(\\d+\\/\\d+ traits, \\d+\\/1 points\\)/')).toBeVisible();

    await trait2.scrollIntoViewIfNeeded();
    await trait2.click();

    const submitButton = page.locator('button:has-text("Submit Build")');
    await expect(submitButton).toBeDisabled();
    await expect(page.locator('#trait-points-error')).toContainText('the limit is 1');
  });
});
