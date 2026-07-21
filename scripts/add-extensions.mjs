import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js')) processFile(full);
  }
}

function processFile(filePath) {
  let content = readFileSync(filePath, 'utf-8');
  const original = content;

  content = content.replace(
    /((?:import|export)\s+(?:(?:[\w*\s{,}]*)\s+from\s+)?['"])(\.\.?\/[^'"]+)['"]/g,
    (match, prefix, path) => {
      if (path.endsWith('.js') || path.endsWith('.mjs') || path.endsWith('.cjs')) return match;
      return `${prefix}${path}.js'`;
    }
  );

  content = content.replace(
    /(export\s+\*\s+from\s+['"])(\.\.?\/[^'"]+)['"]/g,
    (match, prefix, path) => {
      if (path.endsWith('.js') || path.endsWith('.mjs') || path.endsWith('.cjs')) return match;
      return `${prefix}${path}.js'`;
    }
  );

  if (content !== original) {
    writeFileSync(filePath, content, 'utf-8');
  }
}

walk(distDir);
console.log('Extensions added to dist/ files');
