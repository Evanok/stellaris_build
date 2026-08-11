import { Page } from '@playwright/test';

/**
 * Clicks the build form's Submit button and dismisses any of the non-blocking
 * warning modals (missing description, rule conflict) that may appear before
 * the real submission goes through - by clicking "Submit Anyway", same as a
 * real user would. A build can trigger more than one warning in sequence.
 */
export async function submitBuildForm(page: Page, buttonText: 'Submit Build' | 'Update Build' = 'Submit Build') {
  const submitButton = page.locator(`button:has-text("${buttonText}")`);
  await submitButton.scrollIntoViewIfNeeded();
  await submitButton.click();

  for (let i = 0; i < 3; i++) {
    const submitAnyway = page.locator('button:has-text("Submit Anyway")');
    try {
      await submitAnyway.waitFor({ state: 'visible', timeout: 1500 });
      await submitAnyway.click();
    } catch {
      break; // no (more) warning modals - real submission already in flight
    }
  }
}
