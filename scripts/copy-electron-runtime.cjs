const { copyFileSync, mkdirSync } = require('node:fs');
const path = require('node:path');

const sourceDirectory = path.join(__dirname, '../src/electron');
const outputDirectory = path.join(__dirname, '../dist/electron');

mkdirSync(outputDirectory, { recursive: true });
for (const fileName of ['main.cjs', 'preload.cjs']) {
  copyFileSync(path.join(sourceDirectory, fileName), path.join(outputDirectory, fileName));
}
