import { Page } from '@playwright/test';

/**
 * Login as test user for E2E tests
 * Creates a session using the /api/test/login endpoint
 */
export async function loginAsTestUser(page: Page): Promise<void> {
  // Call the test login endpoint
  const response = await page.request.post('http://localhost:3001/api/test/login');

  if (!response.ok()) {
    throw new Error(`Failed to login as test user: ${response.status()}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error('Test login failed');
  }

  // The session cookie is automatically set by the backend
  // Verify we're logged in by checking /api/user
  const userResponse = await page.request.get('http://localhost:3001/api/user');
  const userData = await userResponse.json();

  if (!userData.user) {
    throw new Error('Session was not created properly');
  }

  console.log(`✓ Logged in as test user: ${userData.user.username}`);
}

/**
 * Logout the current user
 */
export async function logout(page: Page): Promise<void> {
  await page.request.get('http://localhost:3001/auth/logout');
  console.log('✓ Logged out');
}
