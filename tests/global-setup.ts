import { cleanupTestBuilds } from './helpers/cleanup';

async function globalSetup() {
  console.log('\n🧹 Cleaning up test builds before running tests...');
  await cleanupTestBuilds();
}

export default globalSetup;
