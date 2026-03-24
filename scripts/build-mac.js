import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const mode = process.argv[2]; // 'modern' | 'legacy'

if (!mode || (mode !== 'modern' && mode !== 'legacy')) {
  console.error('Usage: node scripts/build-mac.js <modern|legacy>');
  process.exit(1);
}

const config = {
  modern: {
    electronVersion: '40.1.0',
    minSystem: '12.0.0',      // Monterey
    suffix: 'macOS12+',
    arch: 'universal',
  },
  legacy: {
    electronVersion: '28.3.0',
    minSystem: '11.0.0',      // Big Sur
    suffix: 'macOS11-legacy',
    arch: 'universal',
  },
};

const { electronVersion, minSystem, suffix, arch } = config[mode];

console.log(`🚀 Starting ${mode} build for macOS (Electron v${electronVersion}, min OS v${minSystem})...`);

// Read package.json
const pkgPath = path.resolve('package.json');
const pkgContent = fs.readFileSync(pkgPath, 'utf-8');
const pkg = JSON.parse(pkgContent);

// Patch on the fly
pkg.devDependencies.electron = `^${electronVersion}`;
if (!pkg.build.mac) pkg.build.mac = {};
pkg.build.mac.extendInfo = { 
  ...pkg.build.mac.extendInfo,
  LSMinimumSystemVersion: minSystem 
};
pkg.build.directories.output = `release/${mode}`;
pkg.build.artifactName = `Ekklesienter-\${version}-${suffix}.\${ext}`;

// Write temporary package.json
const tempPkgPath = path.resolve('package.json');
fs.writeFileSync(tempPkgPath, JSON.stringify(pkg, null, 2));

try {
  console.log(`📦 Installing electron@${electronVersion}...`);
  execSync(`npm install electron@${electronVersion} --no-save`, { stdio: 'inherit' });
  
  console.log(`🏗️ Building...`);
  execSync('npm run build:renderer && electron-builder --mac', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
} finally {
  console.log(`🧹 Restoring original package.json...`);
  fs.writeFileSync(tempPkgPath, pkgContent);
  
  console.log(`🔄 Re-installing original electron...`);
  execSync(`npm install electron@40.1.0 --no-save`, { stdio: 'inherit' });
}
