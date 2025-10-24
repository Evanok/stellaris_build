import { test, expect } from '@playwright/test';

test.describe('Build Display', () => {
  test('should display builds list without errors', async ({ page }) => {
    // Listen for console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Listen for page errors
    const pageErrors: Error[] = [];
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Go to home page
    await page.goto('/');

    // Wait for builds to load
    await page.waitForSelector('.card', { timeout: 5000 });

    // Check that we have builds displayed
    const builds = await page.locator('.card').count();
    expect(builds).toBeGreaterThan(0);

    // Verify no console or page errors
    expect(consoleErrors, 'No console errors should occur').toEqual([]);
    expect(pageErrors, 'No page errors should occur').toEqual([]);
  });

  test('should display build 12 detail page without React errors', async ({ page }) => {
    // Listen for console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Listen for page errors (including React errors)
    const pageErrors: Error[] = [];
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Go directly to build 12 (the problematic build with cost objects)
    await page.goto('/build/12');

    // Wait for build content to load
    await page.waitForSelector('h1', { timeout: 5000 });

    // Verify the build name is displayed
    const buildName = await page.locator('h1').first().textContent();
    expect(buildName).toContain('Guilded Vault');

    // Verify traits are displayed (should show cost as number, not object)
    const traitBadges = await page.locator('.badge:has-text("points")').count();
    expect(traitBadges).toBeGreaterThan(0);

    // Check that trait costs are displayed correctly (should be numbers, not "[object Object]")
    const traitCosts = await page.locator('.badge:has-text("points")').allTextContents();
    for (const cost of traitCosts) {
      expect(cost).not.toContain('[object Object]');
      expect(cost).not.toContain('undefined');
    }

    // Verify no React rendering errors occurred
    expect(consoleErrors.filter(e => e.includes('Minified React error')),
      'No React errors should occur').toEqual([]);
    expect(pageErrors, 'No page errors should occur').toEqual([]);
  });

  test('should display all builds from database', async ({ page }) => {
    // Get builds from API
    const response = await page.request.get('http://localhost:3001/api/builds');
    const data = await response.json();
    const apiBuildsCount = data.builds.length;

    // Go to home page
    await page.goto('/');
    await page.waitForSelector('.card', { timeout: 5000 });

    // Count builds displayed on page
    const displayedBuildsCount = await page.locator('.card').count();

    // They should match (or page might be paginated)
    expect(displayedBuildsCount).toBeGreaterThan(0);
    expect(displayedBuildsCount).toBeLessThanOrEqual(apiBuildsCount);
  });

  test('should display all 11 builds without errors', async ({ page }) => {
    // Listen for console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Listen for page errors
    const pageErrors: Error[] = [];
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Get all builds from API
    const response = await page.request.get('http://localhost:3001/api/builds');
    const data = await response.json();
    const builds = data.builds;

    console.log(`Testing ${builds.length} builds individually...`);

    // Test each build detail page
    for (const build of builds) {
      console.log(`Testing build ${build.id}: ${build.name}`);

      // Clear previous errors
      consoleErrors.length = 0;
      pageErrors.length = 0;

      // Go to build detail page
      await page.goto(`/build/${build.id}`);

      // Wait for build content to load
      await page.waitForSelector('h1', { timeout: 5000 });

      // Verify the build name is displayed
      const buildName = await page.locator('h1').first().textContent();
      expect(buildName).toBeTruthy();

      // Verify no React rendering errors occurred
      const reactErrors = consoleErrors.filter(e => e.includes('Minified React error') || e.includes('React'));
      expect(reactErrors, `Build ${build.id} (${build.name}) should not have React errors`).toEqual([]);
      expect(pageErrors, `Build ${build.id} (${build.name}) should not have page errors`).toEqual([]);
    }
  });
});
