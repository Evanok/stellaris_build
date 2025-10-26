import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/auth';

test.describe('Origin Filtering by Species Type', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/create/manual');
  });

  test('should show Ocean Paradise for BIOLOGICAL, hide for MACHINE', async ({ page }) => {
    // BIOLOGICAL (default) - Ocean Paradise visible, Subaquatic Machines hidden
    const oceanParadise = page.locator('label[for="origin-origin_ocean_paradise"]');
    const subaquaticMachines = page.locator('label[for="origin-origin_ocean_machines"]');

    await expect(oceanParadise).toBeVisible();
    await expect(subaquaticMachines).toHaveCount(0);

    // Switch to MACHINE
    await page.locator('select.form-select').nth(2).selectOption({ label: 'Machine' });

    // Wait for React to re-render - wait for old origin to disappear
    await page.waitForSelector('label[for="origin-origin_ocean_paradise"]', { state: 'detached', timeout: 5000 });

    // Now check new origin is visible
    await expect(subaquaticMachines).toBeVisible();
    await expect(oceanParadise).toHaveCount(0);
  });

  test('should show Post-Apocalyptic for BIOLOGICAL, hide for MACHINE', async ({ page }) => {
    const postApocalyptic = page.locator('label[for="origin-origin_post_apocalyptic"]');
    const radioactiveRovers = page.locator('label[for="origin-origin_post_apocalyptic_machines"]');

    await expect(postApocalyptic).toBeVisible();
    await expect(radioactiveRovers).toHaveCount(0);

    await page.locator('select.form-select').nth(2).selectOption({ label: 'Machine' });

    await expect(radioactiveRovers).toBeVisible();
    await expect(postApocalyptic).toHaveCount(0);
  });

  test('should show Subterranean for BIOLOGICAL, hide for MACHINE', async ({ page }) => {
    const subterranean = page.locator('label[for="origin-origin_subterranean"]');
    const subterraneanMachines = page.locator('label[for="origin-origin_subterranean_machines"]');

    await expect(subterranean).toBeVisible();
    await expect(subterraneanMachines).toHaveCount(0);

    await page.locator('select.form-select').nth(2).selectOption({ label: 'Machine' });

    // Wait for React to re-render - wait for old origin to disappear
    await page.waitForSelector('label[for="origin-origin_subterranean"]', { state: 'detached', timeout: 5000 });

    // Now check new origin is visible
    await expect(subterraneanMachines).toBeVisible();
    await expect(subterranean).toHaveCount(0);
  });

  test('should show Void Dwellers for BIOLOGICAL, hide for MACHINE', async ({ page }) => {
    const voidDwellers = page.locator('label[for="origin-origin_void_dwellers"]');
    const voidforged = page.locator('label[for="origin-origin_void_machines"]');

    await expect(voidDwellers).toBeVisible();
    await expect(voidforged).toHaveCount(0);

    await page.locator('select.form-select').nth(2).selectOption({ label: 'Machine' });

    await expect(voidforged).toBeVisible();
    await expect(voidDwellers).toHaveCount(0);
  });

  test('LITHOID should see same origins as BIOLOGICAL', async ({ page }) => {
    await page.locator('select.form-select').nth(2).selectOption({ label: 'Lithoid' });

    // Should see biological variants
    await expect(page.locator('label[for="origin-origin_ocean_paradise"]')).toBeVisible();
    await expect(page.locator('label[for="origin-origin_post_apocalyptic"]')).toBeVisible();

    // Should NOT see machine variants
    await expect(page.locator('label[for="origin-origin_ocean_machines"]')).toHaveCount(0);
    await expect(page.locator('label[for="origin-origin_post_apocalyptic_machines"]')).toHaveCount(0);
  });

  test('SYNTHETIC should see same origins as MACHINE', async ({ page }) => {
    await page.locator('select.form-select').nth(2).selectOption({ label: 'Synthetic' });

    // Wait for React to re-render - wait for biological origins to disappear
    await page.waitForSelector('label[for="origin-origin_ocean_paradise"]', { state: 'detached', timeout: 5000 });
    await page.waitForSelector('label[for="origin-origin_post_apocalyptic"]', { state: 'detached', timeout: 5000 });

    // Should see machine variants
    await expect(page.locator('label[for="origin-origin_ocean_machines"]')).toBeVisible();
    await expect(page.locator('label[for="origin-origin_post_apocalyptic_machines"]')).toBeVisible();

    // Should NOT see biological variants
    await expect(page.locator('label[for="origin-origin_ocean_paradise"]')).toHaveCount(0);
    await expect(page.locator('label[for="origin-origin_post_apocalyptic"]')).toHaveCount(0);
  });
});
