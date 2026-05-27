import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const moonTvPublicPayloadDir = path.join(rootDir, 'dist', 'moontvplus-public', 'tv');
const tvMiddlewareBypassSnippet = "pathname === '/tv' || pathname.startsWith('/tv/')";

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch (error) {
    return false;
  }
}

async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true });
}

async function copyDir(source, target) {
  await ensureDir(target);
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      await copyDir(sourcePath, targetPath);
    } else {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

async function patchMoonTvMiddleware(targetRoot) {
  const middlewarePath = path.join(targetRoot, 'src', 'middleware.ts');
  if (!(await exists(middlewarePath))) {
    throw new Error('Target MoonTVPlus checkout is missing src/middleware.ts.');
  }

  const source = await fs.readFile(middlewarePath, 'utf8');
  if (source.includes(tvMiddlewareBypassSnippet)) {
    return {
      middlewarePath,
      patched: false
    };
  }

  const needle = "function shouldSkipAuth(pathname: string): boolean {\n  const skipPaths = [\n";
  if (!source.includes(needle)) {
    throw new Error(
      'Target src/middleware.ts has an unexpected format. Add a public /tv bypass before deploying the TV frontend.'
    );
  }

  const patchedSource = source.replace(
    needle,
    "function shouldSkipAuth(pathname: string): boolean {\n  if (pathname === '/tv' || pathname.startsWith('/tv/')) {\n    return true;\n  }\n\n  const skipPaths = [\n"
  );
  await fs.writeFile(middlewarePath, patchedSource);

  return {
    middlewarePath,
    patched: true
  };
}

async function main() {
  const targetRoot = process.argv[2];
  if (!targetRoot) {
    throw new Error('Usage: npm run deploy:moontvplus -- /path/to/MoonTVPlus');
  }

  if (!(await exists(moonTvPublicPayloadDir))) {
    throw new Error('Missing dist/moontvplus-public/tv. Run `npm run build` first.');
  }

  const resolvedTargetRoot = path.resolve(targetRoot);
  const publicDir = path.join(resolvedTargetRoot, 'public');
  const packageJsonPath = path.join(resolvedTargetRoot, 'package.json');
  const targetDir = path.join(publicDir, 'tv');

  if (!(await exists(packageJsonPath)) || !(await exists(publicDir))) {
    throw new Error('Target does not look like a MoonTVPlus checkout with a public directory.');
  }

  await fs.rm(targetDir, { recursive: true, force: true });
  await copyDir(moonTvPublicPayloadDir, targetDir);
  const middlewareResult = await patchMoonTvMiddleware(resolvedTargetRoot);

  console.log('Installed TV frontend into MoonTVPlus.');
  console.log('Target:', targetDir);
  console.log(
    middlewareResult.patched
      ? 'Patched MoonTVPlus middleware for public /tv access: ' + middlewareResult.middlewarePath
      : 'MoonTVPlus middleware already allows public /tv access: ' + middlewareResult.middlewarePath
  );
  console.log('Open it at: https://your-moontv-host/tv/index.html');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
