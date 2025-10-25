import { test, expect } from '@playwright/test';

/**
 * Tests to verify all game assets (images) exist for all game elements
 * This prevents 404 errors on build detail pages
 */

test.describe('Game Assets - Image Availability', () => {
  test('all trait images should exist', async ({ page }) => {
    // Fetch all traits from API
    const response = await page.request.get('http://localhost:3001/api/traits');
    const allTraits = await response.json();

    // Apply same filter as frontend (BuildForm.tsx line 331)
    // Only test traits that are actually displayed (cost !== 0)
    const displayedTraits = allTraits.filter((trait: any) =>
      typeof trait.cost === 'number' && trait.cost !== 0
    );

    const missing: string[] = [];

    // Check each displayed trait has an image
    for (const trait of displayedTraits) {
      const imageUrl = `http://localhost:3000/icons/traits/${trait.id}.png`;
      const imgResponse = await page.request.get(imageUrl);

      if (imgResponse.status() === 404) {
        missing.push(`${trait.id} - ${trait.name}`);
      }
    }

    expect(missing, `Missing trait images (${missing.length}/${displayedTraits.length} displayed traits): ${JSON.stringify(missing, null, 2)}`).toEqual([]);
  });

  test('all origin images should exist', async ({ page }) => {
    // Fetch all origins from API
    const response = await page.request.get('http://localhost:3001/api/origins');
    const origins = await response.json();

    const missingOriginal: string[] = [];
    const missingMini: string[] = [];

    // Check each origin has both original and mini images
    for (const origin of origins) {
      const originalUrl = `http://localhost:3000/icons/origin_original/${origin.id}.png`;
      const miniUrl = `http://localhost:3000/icons/origin_mini/${origin.id}.png`;

      const originalResponse = await page.request.get(originalUrl);
      const miniResponse = await page.request.get(miniUrl);

      if (originalResponse.status() === 404) {
        missingOriginal.push(`${origin.id} - ${origin.name}`);
      }
      if (miniResponse.status() === 404) {
        missingMini.push(`${origin.id} - ${origin.name}`);
      }
    }

    expect(missingOriginal, `Missing origin_original images (${missingOriginal.length}): ${JSON.stringify(missingOriginal, null, 2)}`).toEqual([]);
    expect(missingMini, `Missing origin_mini images (${missingMini.length}): ${JSON.stringify(missingMini, null, 2)}`).toEqual([]);
  });

  test('all ethic images should exist', async ({ page }) => {
    const response = await page.request.get('http://localhost:3001/api/ethics');
    const ethics = await response.json();

    const missing: string[] = [];

    for (const ethic of ethics) {
      const imageUrl = `http://localhost:3000/icons/ethics/${ethic.id}.png`;
      const imgResponse = await page.request.get(imageUrl);

      if (imgResponse.status() === 404) {
        missing.push(`${ethic.id} - ${ethic.name}`);
      }
    }

    expect(missing, `Missing ethic images (${missing.length}): ${JSON.stringify(missing, null, 2)}`).toEqual([]);
  });

  test('all authority images should exist', async ({ page }) => {
    const response = await page.request.get('http://localhost:3001/api/authorities');
    const authorities = await response.json();

    const missing: string[] = [];

    for (const authority of authorities) {
      const imageUrl = `http://localhost:3000/icons/authorities/${authority.id}.png`;
      const imgResponse = await page.request.get(imageUrl);

      if (imgResponse.status() === 404) {
        missing.push(`${authority.id} - ${authority.name}`);
      }
    }

    expect(missing, `Missing authority images (${missing.length}): ${JSON.stringify(missing, null, 2)}`).toEqual([]);
  });

  test('all civic images should exist', async ({ page }) => {
    const response = await page.request.get('http://localhost:3001/api/civics');
    const civics = await response.json();

    const missing: string[] = [];

    for (const civic of civics) {
      const imageUrl = `http://localhost:3000/icons/civics/${civic.id}.png`;
      const imgResponse = await page.request.get(imageUrl);

      if (imgResponse.status() === 404) {
        missing.push(`${civic.id} - ${civic.name}`);
      }
    }

    expect(missing, `Missing civic images (${missing.length}): ${JSON.stringify(missing, null, 2)}`).toEqual([]);
  });

  test('all ascension perk images should exist', async ({ page }) => {
    const response = await page.request.get('http://localhost:3001/api/ascension-perks');
    const data = await response.json();
    const perks = data.all || data; // Handle both array and {all: []} formats

    const missing: string[] = [];

    for (const perk of perks) {
      const imageUrl = `http://localhost:3000/icons/ascension_perks/${perk.id}.png`;
      const imgResponse = await page.request.get(imageUrl);

      if (imgResponse.status() === 404) {
        missing.push(`${perk.id} - ${perk.name}`);
      }
    }

    expect(missing, `Missing ascension perk images (${missing.length}): ${JSON.stringify(missing, null, 2)}`).toEqual([]);
  });

  test('all tradition images should exist', async ({ page }) => {
    const response = await page.request.get('http://localhost:3001/api/traditions');
    const data = await response.json();

    // Apply same filter as frontend (BuildForm.tsx line 455)
    // Only test traditions that are actually displayed (have valid adopt structure)
    const displayedTraditionIds = Object.keys(data).filter(key =>
      data[key].adopt && data[key].adopt.name
    );

    const missing: string[] = [];

    for (const traditionId of displayedTraditionIds) {
      const tradition = data[traditionId];
      const imageUrl = `http://localhost:3000/icons/traditions/${traditionId}.png`;
      const imgResponse = await page.request.get(imageUrl);

      if (imgResponse.status() === 404) {
        missing.push(`${traditionId} - ${tradition.adopt.name}`);
      }
    }

    expect(missing, `Missing tradition images (${missing.length}/${displayedTraditionIds.length} displayed traditions): ${JSON.stringify(missing, null, 2)}`).toEqual([]);
  });

  test('all ruler trait images should exist', async ({ page }) => {
    const response = await page.request.get('http://localhost:3001/api/ruler-traits');
    const rulerTraits = await response.json();

    const missing: string[] = [];

    for (const trait of rulerTraits) {
      const imageUrl = `http://localhost:3000/icons/ruler_traits/${trait.id}.png`;
      const imgResponse = await page.request.get(imageUrl);

      if (imgResponse.status() === 404) {
        missing.push(`${trait.id} - ${trait.name}`);
      }
    }

    expect(missing, `Missing ruler trait images (${missing.length}): ${JSON.stringify(missing, null, 2)}`).toEqual([]);
  });
});
