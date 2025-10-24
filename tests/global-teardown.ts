import { cleanupTestBuilds } from './helpers/cleanup';

async function globalTeardown() {
  console.log('\n🧹 Cleaning up test builds after tests completed...');
  try {
    await cleanupTestBuilds();
  } catch (error) {
    console.warn('⚠️  Post-test cleanup failed:', error);
  }
}

export default globalTeardown;
