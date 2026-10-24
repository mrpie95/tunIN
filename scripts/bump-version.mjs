// Usage: node scripts/bump-version.mjs <x.y.z>
// Updates web/version.js and desktop/package.json, and turns the "Unreleased" section of
// web/CHANGELOG.md into a dated release section (leaving a fresh, empty Unreleased on top).
import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version || '')) {
  console.error('Usage: node scripts/bump-version.mjs <x.y.z>');
  process.exit(1);
}
const date = new Date().toISOString().slice(0, 10);

writeFileSync('web/version.js',
  `// Single source of truth for the app version. Change it with: node scripts/bump-version.mjs <x.y.z>\nconst APP_VERSION = '${version}';\n`);

const pkg = JSON.parse(readFileSync('desktop/package.json', 'utf8'));
pkg.version = version;
writeFileSync('desktop/package.json', JSON.stringify(pkg, null, 2) + '\n');

const log = readFileSync('web/CHANGELOG.md', 'utf8');
if (!log.includes('## [Unreleased]')) { console.error('CHANGELOG.md has no "## [Unreleased]" section'); process.exit(1); }
writeFileSync('web/CHANGELOG.md', log.replace('## [Unreleased]', `## [Unreleased]\n\n## [${version}] - ${date}`));

console.log(`Bumped to ${version}. Review web/CHANGELOG.md, then: git commit -am "Release v${version}" && git tag v${version}`);
