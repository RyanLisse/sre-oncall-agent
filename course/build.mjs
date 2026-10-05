import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const courseDir = dirname(fileURLToPath(import.meta.url));
const moduleFiles = readdirSync(join(courseDir, 'modules'))
  .filter((name) => name.endsWith('.html'))
  .sort();
const output = [
  readFileSync(join(courseDir, '_base.html'), 'utf8'),
  ...moduleFiles.map((name) => readFileSync(join(courseDir, 'modules', name), 'utf8')),
  readFileSync(join(courseDir, '_footer.html'), 'utf8'),
].join('');
const indexPath = join(courseDir, 'index.html');

if (process.argv.includes('--check')) {
  const current = readFileSync(indexPath, 'utf8');
  if (current !== output) {
    console.error('course/index.html is out of date. Run npm run course:build.');
    process.exit(1);
  }
  console.log('course/index.html is up to date.');
} else {
  writeFileSync(indexPath, output);
  console.log('Built course/index.html — open it in your browser.');
}
