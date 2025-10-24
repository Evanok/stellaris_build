/**
 * Test cleanup helpers
 */

export async function cleanupTestBuilds(baseURL: string = 'http://localhost:3001') {
  const response = await fetch(`${baseURL}/api/test/cleanup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Cleanup failed: ${response.statusText}`);
  }

  const result = await response.json();
  console.log(`✓ Cleanup: ${result.message}`);
  return result;
}
