import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const tvMiddlewareBypassSnippet = "pathname === '/tv' || pathname.startsWith('/tv/')";

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  const targetRoot = process.argv[2];
  if (!targetRoot) {
    console.error('Usage: npm run validate:deploy -- /path/to/MoonTVPlus');
    process.exit(1);
  }

  const resolvedTarget = path.resolve(targetRoot);
  const tvDir = path.join(resolvedTarget, 'public', 'tv');
  const middlewarePath = path.join(resolvedTarget, 'src', 'middleware.ts');
  const requiredFiles = ['index.html', 'app.js', 'styles.css', path.join('vendor', 'hls.min.js')];

  if (!(await exists(tvDir))) {
    console.error('Missing deployed TV directory: ' + tvDir);
    process.exit(1);
  }

  const missing = [];
  for (const relativePath of requiredFiles) {
    if (!(await exists(path.join(tvDir, relativePath)))) {
      missing.push(relativePath);
    }
  }

  if (missing.length) {
    console.error('Deployment is incomplete. Missing: ' + missing.join(', '));
    process.exit(1);
  }

  if (!(await exists(middlewarePath))) {
    console.error('Missing MoonTVPlus middleware file: ' + middlewarePath);
    process.exit(1);
  }

  const middlewareSource = await fs.readFile(middlewarePath, 'utf8');
  if (!middlewareSource.includes(tvMiddlewareBypassSnippet)) {
    console.error('MoonTVPlus middleware does not expose /tv publicly. Re-run `npm run deploy:moontvplus`.');
    process.exit(1);
  }

  console.log('Deployment looks valid at ' + tvDir);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
