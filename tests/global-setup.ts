import { cleanupTestBuilds } from './helpers/cleanup';

async function globalSetup() {
  console.log('\n🧹 Cleaning up test builds before running tests...');
  try {
    await cleanupTestBuilds();
  } catch (error) {
    console.warn('⚠️  Cleanup failed (this is OK if test user does not exist yet):', error);
  }
}

export default globalSetup;
