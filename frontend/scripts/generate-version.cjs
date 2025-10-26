#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  // Get the latest git tag
  const version = execSync('git describe --tags --abbrev=0', { encoding: 'utf-8' }).trim();

  // Get the commit hash
  const commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();

  // Get the commit date
  const commitDate = execSync('git log -1 --format=%ci', { encoding: 'utf-8' }).trim();

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
