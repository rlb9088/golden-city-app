const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TARGET_DIRS = ['config', 'controllers', 'lib', 'middleware', 'repositories', 'routes', 'schemas', 'scripts', 'services', 'utils'];
const TARGET_FILES = ['index.js'];

function collectFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, files);
      continue;
    }
    if (/\.(?:js|mjs)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = [
  ...TARGET_FILES.map((file) => path.join(ROOT, file)),
  ...TARGET_DIRS.flatMap((dir) => collectFiles(path.join(ROOT, dir))),
].sort();

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
