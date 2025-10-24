/**
 * Test cleanup helpers
 */

export async function cleanupTestBuilds(baseURL: string = 'http://localhost:3001') {
  try {
    const response = await fetch(`${baseURL}/api/test/cleanup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Server responded but cleanup failed (e.g., endpoint doesn't exist)
      console.warn(`⚠️  Cleanup endpoint returned ${response.status} (OK if test user doesn't exist)`);
      return { deleted: 0, message: 'Cleanup skipped - endpoint not ready' };
    }

    const result = await response.json();
    console.log(`✓ Cleanup: ${result.message}`);
    return result;
  } catch (error: any) {
    // Network error (e.g., backend not running)
    if (error.cause?.code === 'ECONNREFUSED') {
      console.warn('⚠️  Backend not running yet - cleanup skipped');
    } else {
      console.warn(`⚠️  Cleanup failed: ${error.message}`);
    }
    return { deleted: 0, message: 'Cleanup skipped - backend not available' };
  }
}
