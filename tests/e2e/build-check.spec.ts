import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

// Get the project root directory (2 levels up from tests/e2e/)
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const FRONTEND_DIR = path.join(PROJECT_ROOT, 'frontend');

/**
 * Build Check Tests
 * Ensures TypeScript compilation succeeds before deployment
 * Catches type errors that would break production builds
 */

test.describe('Production Build Checks', () => {
  test('frontend should compile without TypeScript errors', async () => {
    console.log('\n🔨 Running TypeScript compilation check...');
    console.log(`📁 Project root: ${PROJECT_ROOT}`);

    try {
      const { stdout, stderr } = await execAsync('npm run build -w frontend', {
        cwd: PROJECT_ROOT,
        timeout: 120000 // 2 minutes timeout
      });

      console.log('✅ TypeScript compilation successful!');

      if (stdout) {
        console.log('\nBuild output (last 500 chars):');
        console.log(stdout.slice(-500));
      }

      // Check that build succeeded (no errors)
      expect(stderr).not.toContain('error TS');
      expect(stdout).toContain('built in'); // Vite success message

    } catch (error: any) {
      // Build failed - capture and display the error
      console.error('❌ TypeScript compilation failed!');
      console.error('\n=== FULL ERROR OUTPUT ===');

      if (error.stdout) {
        console.error('\n--- STDOUT ---');
        console.error(error.stdout);
      }

      if (error.stderr) {
        console.error('\n--- STDERR ---');
        console.error(error.stderr);
      }

      // Extract just the TypeScript errors if present
      const fullOutput = error.stdout || error.stderr || '';
      const tsErrors = fullOutput.split('\n').filter(line =>
        line.includes('error TS') ||
        line.includes('.ts(') ||
        line.includes('.tsx(')
      );

      if (tsErrors.length > 0) {
        console.error('\n=== TYPESCRIPT ERRORS ===');
        console.error(tsErrors.join('\n'));
      }

      // Fail the test with a clear message
      throw new Error(`Frontend build failed. See console output above for details.`);
    }
  });

  test('frontend should pass TypeScript type check only', async () => {
    console.log('\n🔍 Running TypeScript type check (tsc --noEmit)...');
    console.log(`📁 Frontend dir: ${FRONTEND_DIR}`);

    try {
      const { stdout, stderr } = await execAsync('npx tsc --noEmit', {
        cwd: FRONTEND_DIR,
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

      const output = error.stdout || error.stderr || '';

      console.error('\n=== FULL TYPE CHECK OUTPUT ===');
      console.error(output);

      // Extract and highlight the errors
      const lines = output.split('\n');
      const errorLines = lines.filter(line =>
        line.includes('error TS') ||
        line.includes('.ts(') ||
        line.includes('.tsx(')
      );

      if (errorLines.length > 0) {
        console.error('\n=== TYPE ERRORS SUMMARY ===');
        console.error(errorLines.join('\n'));

        // Count errors
        const errorCount = errorLines.filter(line => line.includes('error TS')).length;
        console.error(`\n📊 Total type errors: ${errorCount}`);
      }

      throw new Error(`TypeScript type check failed with errors. See console output above.`);
    }
  });
});
