#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// A production deploy builds from a `git archive` with no .git: the deploy kit
// resolves these on the dev machine and passes them in the environment.
const fromDeploy = (name) => (process.env[name] || '').trim();
const git = (command) => execSync(command, { encoding: 'utf-8' }).trim();

try {
  // Latest git tag
  const version = fromDeploy('DEPLOY_LATEST_TAG') || git('git describe --tags --abbrev=0');

  // Commit hash
  const commitHash = fromDeploy('DEPLOY_REVISION').slice(0, 7) || git('git rev-parse --short HEAD');

  // Commit date
  const commitDate = fromDeploy('DEPLOY_COMMIT_DATE') || git('git log -1 --format=%ci');

  const versionInfo = {
    version,
    commitHash,
    commitDate,
    buildDate: new Date().toISOString()
  };

  // Write to public directory so it's accessible at runtime
  const outputPath = path.join(__dirname, '..', 'public', 'version.json');
  fs.writeFileSync(outputPath, JSON.stringify(versionInfo, null, 2));

  console.log(`✓ Generated version.json: ${version} (${commitHash})`);
} catch (error) {
  console.error('Failed to generate version:', error.message);

  // Fallback version
  const fallbackVersion = {
    version: 'v1.0.0',
    commitHash: 'unknown',
    commitDate: new Date().toISOString(),
    buildDate: new Date().toISOString()
  };

  const outputPath = path.join(__dirname, '..', 'public', 'version.json');
  fs.writeFileSync(outputPath, JSON.stringify(fallbackVersion, null, 2));

  console.log('✓ Generated fallback version.json');
}
