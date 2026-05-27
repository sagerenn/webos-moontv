import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { resolveWebOsCli } from './webos-cli.mjs';

const rootDir = process.cwd();
const launcherDir = path.join(rootDir, 'dist', 'launcher');

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch (error) {
    return false;
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function main() {
  const buildResult = spawnSync('npm', ['run', 'build'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env
  });

  if (buildResult.status !== 0) {
    process.exit(buildResult.status || 1);
  }

  if (!(await exists(launcherDir))) {
    fail('Missing dist/launcher after build.');
  }

  const aresPackage = await resolveWebOsCli(rootDir, 'ares-package');
  if (!aresPackage) {
    fail(
      'LG webOS CLI is not installed. Install the ares tools, then rerun `npm run package:webos`.'
    );
  }

  const packageResult = spawnSync(aresPackage, [launcherDir], {
    cwd: rootDir,
    stdio: 'inherit'
  });

  if (packageResult.status !== 0) {
    process.exit(packageResult.status || 1);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
