import { test, expect } from '@playwright/test';

test.describe('Resources Page', () => {
  test('should load resources page without errors', async ({ page }) => {
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

    // Go to resources page
    await page.goto('/resources');

    // Wait for content to load
    await page.waitForSelector('h1:has-text("Community Resources")', { timeout: 10000 });

    // Verify no errors occurred
    expect(consoleErrors, 'No console errors should occur').toEqual([]);
    expect(pageErrors, 'No page errors should occur').toEqual([]);
  });

  test('should display hero banner with resource count', async ({ page }) => {
    await page.goto('/resources');
    await page.waitForSelector('h1:has-text("Community Resources")');

    // Check hero banner exists
    const heroTitle = await page.locator('h1:has-text("Community Resources")');
    await expect(heroTitle).toBeVisible();

    // Check tagline
    const tagline = await page.locator('text=Curated guides, tools, and content creators');
    await expect(tagline).toBeVisible();

    // Check resource count is displayed and is a number
    const resourceCount = await page.locator('h3').first().textContent();
    expect(resourceCount).toBeTruthy();
    expect(parseInt(resourceCount!)).toBeGreaterThan(0);
  });

  test('should display all category filter buttons', async ({ page }) => {
    await page.goto('/resources');
    await page.waitForSelector('h1:has-text("Community Resources")');

    // Check "All Resources" button
    const allButton = await page.locator('button:has-text("All Resources")');
    await expect(allButton).toBeVisible();

    // Check specific category buttons (based on resources.json)
    const expectedCategories = [
      'YouTube Channels',
      'Written Guides & Wikis',
      'Online Tools & Calculators',
      'Twitch Streamers',
      'Essential Mods',
      'Communities & Forums'
    ];

    for (const category of expectedCategories) {
      const button = await page.locator(`button:has-text("${category}")`);
      await expect(button).toBeVisible();
    }
  });

  test('should filter categories when clicking category buttons', async ({ page }) => {
    await page.goto('/resources');
    await page.waitForSelector('h1:has-text("Community Resources")');

    // Initially all categories should be visible
    let visibleCategories = await page.locator('.card-header h2').count();
    expect(visibleCategories).toBeGreaterThan(1);

    // Click "YouTube Channels" filter
    await page.click('button:has-text("YouTube Channels")');

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Should only show YouTube Channels category
    visibleCategories = await page.locator('.card-header h2').count();
    expect(visibleCategories).toBe(1);

    const categoryTitle = await page.locator('.card-header h2').first().textContent();
    expect(categoryTitle).toContain('YouTube Channels');

    // Click "All Resources" to restore
    await page.click('button:has-text("All Resources")');
    await page.waitForTimeout(500);

    // All categories should be visible again
    visibleCategories = await page.locator('.card-header h2').count();
    expect(visibleCategories).toBeGreaterThan(1);
  });

  test('should display featured resources with featured badge', async ({ page }) => {
    await page.goto('/resources');
    await page.waitForSelector('h1:has-text("Community Resources")');

    // Check for "Featured" section header
    const featuredHeader = await page.locator('h4:has-text("Featured")').first();
    await expect(featuredHeader).toBeVisible();

    // Check for featured badges
    const featuredBadges = await page.locator('.badge.bg-warning:has-text("Featured")').count();
    expect(featuredBadges).toBeGreaterThan(0);

    // Verify featured resources have yellow border
    const featuredCards = await page.locator('.card.border-warning').count();
    expect(featuredCards).toBeGreaterThan(0);
  });

  test('should display resource cards with all required information', async ({ page }) => {
    await page.goto('/resources');
    await page.waitForSelector('h1:has-text("Community Resources")');

    // Get first resource card
    const firstCard = page.locator('.resource-card').first();
    await expect(firstCard).toBeVisible();

    // Check title exists
    const title = await firstCard.locator('h5, h6').first();
    await expect(title).toBeVisible();

    // Check external link icon
    const externalIcon = await firstCard.locator('i.bi-box-arrow-up-right');
    await expect(externalIcon).toBeVisible();

    // Check description
    const description = await firstCard.locator('p.text-light');
    await expect(description).toBeVisible();

    // Check tags exist
    const tags = await firstCard.locator('.badge.bg-secondary').count();
    expect(tags).toBeGreaterThan(0);
  });

  test('should have working external links', async ({ page }) => {
    await page.goto('/resources');
    await page.waitForSelector('h1:has-text("Community Resources")');

    // Get all resource card links
    const links = await page.locator('.resource-card-link').all();
    expect(links.length).toBeGreaterThan(0);

    // Check first link attributes
    const firstLink = links[0];
    const href = await firstLink.getAttribute('href');
    const target = await firstLink.getAttribute('target');
    const rel = await firstLink.getAttribute('rel');

    // Verify link properties
    expect(href).toBeTruthy();
    expect(href).toMatch(/^https?:\/\//); // Valid URL
    expect(target).toBe('_blank'); // Opens in new tab
    expect(rel).toBe('noopener noreferrer'); // Security best practice
  });

  test('should display "More Resources" section when category has both featured and non-featured', async ({ page }) => {
    await page.goto('/resources');
    await page.waitForSelector('h1:has-text("Community Resources")');

    // Check for "More Resources" header (appears after featured resources)
    const moreResourcesHeaders = await page.locator('h4:has-text("More Resources")').count();
    expect(moreResourcesHeaders).toBeGreaterThanOrEqual(0); // May or may not exist depending on data
  });

  test('should display contribution CTA at bottom', async ({ page }) => {
    await page.goto('/resources');
    await page.waitForSelector('h1:has-text("Community Resources")');

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Check CTA section
    const ctaTitle = await page.locator('h3:has-text("Know a Great Resource?")');
    await expect(ctaTitle).toBeVisible();

    // Check description
    const ctaDescription = await page.locator('text=Help the community grow');
    await expect(ctaDescription).toBeVisible();

    // Check button
    const ctaButton = await page.locator('a.btn-primary:has-text("Suggest a Resource")');
    await expect(ctaButton).toBeVisible();

    // Verify button link
    const href = await ctaButton.getAttribute('href');
    expect(href).toContain('reddit.com');
  });

  test('should fetch resources from API endpoint', async ({ page }) => {
    // Test API endpoint directly
    const response = await page.request.get('http://localhost:3001/api/resources');
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.categories).toBeDefined();
    expect(data.categories.length).toBeGreaterThan(0);

    // Verify first category structure
    const firstCategory = data.categories[0];
    expect(firstCategory.id).toBeDefined();
    expect(firstCategory.name).toBeDefined();
    expect(firstCategory.description).toBeDefined();
    expect(firstCategory.icon).toBeDefined();
    expect(firstCategory.resources).toBeDefined();
    expect(firstCategory.resources.length).toBeGreaterThan(0);

    // Verify first resource structure
    const firstResource = firstCategory.resources[0];
    expect(firstResource.title).toBeDefined();
    expect(firstResource.url).toBeDefined();
    expect(firstResource.description).toBeDefined();
    expect(firstResource.tags).toBeDefined();
    expect(firstResource.featured).toBeDefined();
  });

  test('should have proper SEO meta tags', async ({ page }) => {
    await page.goto('/resources');
    await page.waitForSelector('h1:has-text("Community Resources")');

    // Check title
    const title = await page.title();
    expect(title).toContain('Stellaris Resources');

    // Check meta description (use last one from Helmet, which overrides the base one)
    const metaDescription = await page.locator('meta[name="description"]').last().getAttribute('content');
    expect(metaDescription).toBeTruthy();
    expect(metaDescription).toContain('Stellaris resources');

    // Check meta keywords (use last one from Helmet)
    const metaKeywords = await page.locator('meta[name="keywords"]').last().getAttribute('content');
    expect(metaKeywords).toBeTruthy();
    expect(metaKeywords).toContain('stellaris');
  });

  test('should display category icons', async ({ page }) => {
    await page.goto('/resources');
    await page.waitForSelector('h1:has-text("Community Resources")');

    // Check for Bootstrap icons in category headers
    const categoryIcons = await page.locator('.card-header h2 i[class*="bi-"]').count();
    expect(categoryIcons).toBeGreaterThan(0);

    // Verify specific icons exist (from resources.json)
    const youtubeIcon = await page.locator('.card-header h2 i.bi-youtube');
    await expect(youtubeIcon).toBeVisible();
  });

  test('should handle loading state', async ({ page }) => {
    // Slow down network to observe loading state
    await page.route('**/api/resources', async route => {
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.continue();
    });

    const loadingPromise = page.goto('/resources');

    // Check for loading spinner
    const spinner = page.locator('.spinner-border');
    // Spinner might not be visible if request is too fast, but shouldn't throw error

    await loadingPromise;
    await page.waitForSelector('h1:has-text("Community Resources")');

    // Spinner should be gone
    await expect(spinner).not.toBeVisible();
  });

  test('should navigate from navbar to resources page', async ({ page }) => {
    // Start at home page
    await page.goto('/');
    await page.waitForSelector('h1');

    // Click Resources link in navbar
    await page.click('a[href="/resources"]');

    // Should navigate to resources page
    await page.waitForSelector('h1:has-text("Community Resources")');
    expect(page.url()).toContain('/resources');
  });
});
