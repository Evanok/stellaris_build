import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Build Check Tests
 * Ensures TypeScript compilation succeeds before deployment
 * Catches type errors that would break production builds
 */

test.describe('Production Build Checks', () => {
  test('frontend should compile without TypeScript errors', async () => {
    console.log('\n🔨 Running TypeScript compilation check...');

    try {
      const { stdout, stderr } = await execAsync('npm run build -w frontend', {
        cwd: '/home/arthur/work/stellaris_build',
        timeout: 120000 // 2 minutes timeout
      });

      console.log('✅ TypeScript compilation successful!');

      if (stdout) {
        console.log('\nBuild output:');
        console.log(stdout);
      }

      // Check that build succeeded (no errors)
      expect(stderr).not.toContain('error TS');
      expect(stdout).toContain('built in'); // Vite success message

    } catch (error: any) {
      // Build failed - capture and display the error
      console.error('❌ TypeScript compilation failed!');
      console.error('\nError output:');
      console.error(error.stderr || error.stdout);

      // Fail the test with a clear message
      throw new Error(`Frontend build failed with TypeScript errors:\n${error.stderr || error.stdout}`);
    }
  });

  test('frontend should pass TypeScript type check only', async () => {
    console.log('\n🔍 Running TypeScript type check (tsc --noEmit)...');

    try {
      const { stdout, stderr } = await execAsync('npx tsc --noEmit', {
        cwd: '/home/arthur/work/stellaris_build/frontend',
        timeout: 60000 // 1 minute timeout
      });

      console.log('✅ TypeScript type check passed!');

      // tsc --noEmit should produce no output if successful
      // Any output usually indicates errors
      if (stderr && stderr.includes('error TS')) {
        throw new Error(`TypeScript errors found:\n${stderr}`);
      }

    } catch (error: any) {
      console.error('❌ TypeScript type check failed!');
      console.error('\nType errors:');
      console.error(error.stderr || error.stdout);

      throw new Error(`TypeScript type check failed:\n${error.stderr || error.stdout}`);
    }
  });
});
