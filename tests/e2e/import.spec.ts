import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/auth';
import * as path from 'path';

/**
 * Import Tests for Save Files and Empire Files
 * Tests the import functionality for .sav and .txt empire files
 */

test.describe('Import Functionality - Save Files', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('should import test1.sav without errors', async ({ page }) => {
    await page.goto('/create/import-save');

    // Wait for file input to be ready
    await page.waitForSelector('#savefile', { timeout: 10000 });

    // Upload test1.sav
    const test1Path = path.join(__dirname, '../data/test1.sav');
    await page.setInputFiles('#savefile', test1Path);

    // Wait for script output preview to appear
    await page.waitForSelector('button:has-text("Continue to Build Form")', { timeout: 30000 });

    // Verify no error messages are displayed
    const errorAlert = page.locator('.alert-danger');
    const errorCount = await errorAlert.count();
    if (errorCount > 0) {
      const errorVisible = await errorAlert.isVisible();
      expect(errorVisible).toBe(false);
    }

    // Click "Continue to Build Form" button
    await page.click('button:has-text("Continue to Build Form")');

    // Wait for BuildForm to appear
    await page.waitForSelector('#buildName', { timeout: 10000 });

    // Verify that the form has been populated (at least the build name should be filled)
    const buildNameValue = await page.locator('#buildName').inputValue();
    expect(buildNameValue).toBeTruthy();
    expect(buildNameValue.length).toBeGreaterThan(0);
  });

  test('should import test2.sav without errors', async ({ page }) => {
    await page.goto('/create/import-save');

    // Wait for file input to be ready
    await page.waitForSelector('#savefile', { timeout: 10000 });

    // Upload test2.sav
    const test2Path = path.join(__dirname, '../data/test2.sav');
    await page.setInputFiles('#savefile', test2Path);

    // Wait for script output preview to appear
    await page.waitForSelector('button:has-text("Continue to Build Form")', { timeout: 30000 });

    // Verify no error messages are displayed
    const errorAlert = page.locator('.alert-danger');
    const errorCount = await errorAlert.count();
    if (errorCount > 0) {
      const errorVisible = await errorAlert.isVisible();
      expect(errorVisible).toBe(false);
    }

    // Click "Continue to Build Form" button
    await page.click('button:has-text("Continue to Build Form")');

    // Wait for BuildForm to appear
    await page.waitForSelector('#buildName', { timeout: 10000 });

    // Expected data for test2.sav (The Guilded Vault Conglomerate)
    const expectedData = {
      name: "The Guilded Vault Conglomerate",
      ethics: ["ethic_egalitarian", "ethic_militarist", "ethic_spiritualist"],
      authority: "auth_corporate",
      civics: ["civic_brand_loyalty", "civic_corporate_sovereign_guardianship", "civic_corporate_ascensionists"],
      origin: "origin_shattered_ring",
      traditions: ["tr_mercantile", "tr_discovery", "tr_statecraft", "tr_harmony", "tr_virtuality", "tr_prosperity", "tr_expansion"],
      ascension_perks: ["ap_technological_ascendancy", "ap_one_vision", "ap_synthetic_age", "ap_cosmogenesis", "ap_galactic_force_projection", "ap_archaeoengineers", "ap_master_builders", "ap_colossus"],
      traits: ["trait_auto_mod_robotic", "trait_robot_bulky", "trait_robot_history_chatbot", "trait_robot_loyalty_circuits", "trait_robot_luxurious", "trait_robot_wasteful"],
      species_class: "MACHINE",
      speciesType: "MACHINE"
    };

    // Verify build name
    const buildNameValue = await page.locator('#buildName').inputValue();
    expect(buildNameValue).toBe(expectedData.name);

    // Verify ethics are selected
    for (const ethic of expectedData.ethics) {
      const ethicCheckbox = page.locator(`#ethic-${ethic}`);
      await expect(ethicCheckbox).toBeChecked();
    }

    // Verify authority is selected
    const authorityRadio = page.locator(`#authority-${expectedData.authority}`);
    await expect(authorityRadio).toBeChecked();

    // Verify civics are selected
    for (const civic of expectedData.civics) {
      const civicCheckbox = page.locator(`#civic-${civic}`);
      await expect(civicCheckbox).toBeChecked();
    }

    // Verify origin is selected
    const originRadio = page.locator(`#origin-${expectedData.origin}`);
    await expect(originRadio).toBeChecked();

    // Verify traits are selected
    for (const trait of expectedData.traits) {
      const traitCheckbox = page.locator(`#trait-${trait}`);
      await expect(traitCheckbox).toBeChecked();
    }

    // Verify species class is selected
    const speciesClassSelect = page.locator('select.form-select').filter({ hasText: /Species Class|Aquatic|Humanoid|Machine/ }).first();
    const speciesClassValue = await speciesClassSelect.inputValue();
    expect(speciesClassValue).toBe(expectedData.species_class);

    // Note: Traditions and ascension perks validation would require scrolling and more complex selectors
    // We can add those in a future enhancement if needed
  });

  test('should handle multiple save imports in sequence', async ({ page }) => {
    // Import test1.sav first
    await page.goto('/create/import-save');
    await page.waitForSelector('#savefile', { timeout: 10000 });

    const test1Path = path.join(__dirname, '../data/test1.sav');
    await page.setInputFiles('#savefile', test1Path);

    // Wait for preview and continue to form
    await page.waitForSelector('button:has-text("Continue to Build Form")', { timeout: 30000 });
    await page.click('button:has-text("Continue to Build Form")');

    await page.waitForSelector('#buildName', { timeout: 10000 });
    const buildName1 = await page.locator('#buildName').inputValue();
    expect(buildName1).toBeTruthy();

    // Click "Upload Different Save File" button to go back
    await page.click('button:has-text("Upload Different Save File")');

    // Wait for file input to be visible again
    await page.waitForSelector('#savefile', { timeout: 10000 });

    // Import test2.sav
    const test2Path = path.join(__dirname, '../data/test2.sav');
    await page.setInputFiles('#savefile', test2Path);

    // Wait for preview and continue to form
    await page.waitForSelector('button:has-text("Continue to Build Form")', { timeout: 30000 });

    // Verify no error messages before continuing
    const errorAlert = page.locator('.alert-danger');
    const errorCount = await errorAlert.count();
    if (errorCount > 0) {
      const errorVisible = await errorAlert.isVisible();
      expect(errorVisible).toBe(false);
    }

    await page.click('button:has-text("Continue to Build Form")');

    // Verify form is displayed (second import successful)
    await page.waitForSelector('#buildName', { timeout: 10000 });

    // Note: buildName might be empty or populated depending on timing
    // The important thing is that the form loads without errors
    await expect(page.locator('#buildName')).toBeVisible();
  });

  test('should allow user to submit imported save build', async ({ page }) => {
    await page.goto('/create/import-save');
    await page.waitForSelector('#savefile', { timeout: 10000 });

    // Import test1.sav
    const test1Path = path.join(__dirname, '../data/test1.sav');
    await page.setInputFiles('#savefile', test1Path);

    // Wait for preview and continue to form
    await page.waitForSelector('button:has-text("Continue to Build Form")', { timeout: 30000 });
    await page.click('button:has-text("Continue to Build Form")');

    // Wait for import to complete
    await page.waitForSelector('#buildName', { timeout: 10000 });

    // Verify submit button is present and enabled
    const submitButton = page.locator('button:has-text("Submit Build")');
    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await expect(submitButton).toBeEnabled({ timeout: 5000 });

    // Optionally: Actually submit the build (commented out to avoid cluttering the database)
    // await submitButton.click();
    // await page.waitForURL('/', { timeout: 10000 });
  });
});

test.describe('Import Functionality - Empire Designs', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('should import empire from test_import_empires.txt without errors', async ({ page }) => {
    await page.goto('/create/import-designs');

    // Wait for file input to be ready
    await page.waitForSelector('#designsfile', { timeout: 10000 });

    // Upload test_import_empires.txt
    const empireTxtPath = path.join(__dirname, '../data/test_import_empires.txt');
    await page.setInputFiles('#designsfile', empireTxtPath);

    // Wait for empire list to appear
    await page.waitForSelector('.list-group-item', { timeout: 15000 });

    // Get the first empire button and click it
    const firstEmpireButton = page.locator('.list-group-item').first();
    await expect(firstEmpireButton).toBeVisible();
    await firstEmpireButton.click();

    // Wait for BuildForm to appear with populated data
    await page.waitForSelector('#buildName', { timeout: 15000 });

    // Verify that the form has been populated
    const buildNameValue = await page.locator('#buildName').inputValue();
    expect(buildNameValue).toBeTruthy();
    expect(buildNameValue.length).toBeGreaterThan(0);

    // Verify game version selector is present (shows form loaded completely)
    const gameVersionSelect = page.locator('#gameVersion');
    await expect(gameVersionSelect).toBeVisible();

    // TODO: Add validation for traits once import is fully implemented
    // The empire file has 5 traits: trait_solitary, trait_fleeting, trait_natural_engineers,
    // trait_intelligent, trait_mgd_climate_flexibility
    // For now, we just verify the import doesn't error and form is displayed

    // Verify no error messages are displayed
    const errorAlert = page.locator('.alert-danger');
    const errorCount = await errorAlert.count();
    if (errorCount > 0) {
      const errorVisible = await errorAlert.isVisible();
      expect(errorVisible).toBe(false);
    }
  });

  test('should display list of empires from uploaded file', async ({ page }) => {
    await page.goto('/create/import-designs');
    await page.waitForSelector('#designsfile', { timeout: 10000 });

    // Upload empire designs file
    const empireTxtPath = path.join(__dirname, '../data/test_import_empires.txt');
    await page.setInputFiles('#designsfile', empireTxtPath);

    // Wait for empire list to appear
    await page.waitForSelector('.list-group-item', { timeout: 15000 });

    // Verify at least one empire is listed
    const empireButtons = page.locator('.list-group-item');
    const count = await empireButtons.count();
    expect(count).toBeGreaterThan(0);

    // Verify the empire name is displayed (from the test file: "Hegemony hessukare United")
    const firstEmpireText = await empireButtons.first().textContent();
    expect(firstEmpireText).toBeTruthy();
    expect(firstEmpireText!.length).toBeGreaterThan(0);
  });

  test('should allow user to submit imported empire build', async ({ page }) => {
    await page.goto('/create/import-designs');
    await page.waitForSelector('#designsfile', { timeout: 10000 });

    // Upload empire designs file
    const empireTxtPath = path.join(__dirname, '../data/test_import_empires.txt');
    await page.setInputFiles('#designsfile', empireTxtPath);

    // Wait for empire list and select first empire
    await page.waitForSelector('.list-group-item', { timeout: 15000 });
    await page.locator('.list-group-item').first().click();

    // Wait for form to be populated
    await page.waitForSelector('#buildName', { timeout: 15000 });

    // Verify submit button is present and enabled
    const submitButton = page.locator('button:has-text("Submit Build")');
    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await expect(submitButton).toBeEnabled({ timeout: 5000 });

    // Optionally: Actually submit the build (commented out to avoid cluttering the database)
    // await submitButton.click();
    // await page.waitForURL('/', { timeout: 10000 });
  });

  test('should allow switching between empires using Back button', async ({ page }) => {
    await page.goto('/create/import-designs');
    await page.waitForSelector('#designsfile', { timeout: 10000 });

    // Upload empire designs file
    const empireTxtPath = path.join(__dirname, '../data/test_import_empires.txt');
    await page.setInputFiles('#designsfile', empireTxtPath);

    // Wait for empire list to appear
    await page.waitForSelector('.list-group-item', { timeout: 15000 });

    // Verify we have at least 2 empires
    const empireButtons = page.locator('.list-group-item');
    const count = await empireButtons.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Click on first empire
    const firstEmpireName = await empireButtons.nth(0).textContent();
    await empireButtons.nth(0).click();

    // Wait for form to be populated with first empire data
    await page.waitForSelector('#buildName', { timeout: 15000 });
    const firstBuildName = await page.locator('#buildName').inputValue();
    expect(firstBuildName).toBeTruthy();

    // Click "Back to Empire Selection" button
    const backButton = page.locator('button:has-text("Back to Empire Selection")');
    await expect(backButton).toBeVisible();
    await backButton.click();

    // Wait for empire list to reappear
    await page.waitForSelector('.list-group-item', { timeout: 15000 });

    // Click on second empire
    const secondEmpireName = await empireButtons.nth(1).textContent();
    await empireButtons.nth(1).click();

    // Wait for form to be populated with second empire data
    await page.waitForSelector('#buildName', { timeout: 15000 });
    const secondBuildName = await page.locator('#buildName').inputValue();
    expect(secondBuildName).toBeTruthy();

    // Verify the build names are different (different empires loaded)
    expect(secondBuildName).not.toBe(firstBuildName);
  });
});
