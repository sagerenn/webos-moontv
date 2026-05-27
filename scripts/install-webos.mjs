import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { resolveWebOsCli } from './webos-cli.mjs';

const rootDir = process.cwd();

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

async function findLatestIpk() {
  const entries = await fs.readdir(rootDir);
  const ipks = entries.filter((entry) => entry.endsWith('.ipk')).sort();
  if (!ipks.length) {
    return null;
  }

  return path.join(rootDir, ipks[ipks.length - 1]);
}

async function main() {
  const deviceName = process.argv[2];
  if (!deviceName) {
    fail('Usage: npm run install:webos -- <device-name>');
  }

  let packagePath = await findLatestIpk();
  if (!packagePath || !(await exists(packagePath))) {
    const packageResult = spawnSync('npm', ['run', 'package:webos'], {
      cwd: rootDir,
      stdio: 'inherit',
      env: process.env
    });

    if (packageResult.status !== 0) {
      process.exit(packageResult.status || 1);
    }

    packagePath = await findLatestIpk();
  }

  if (!packagePath) {
    fail('No .ipk package found after packaging.');
  }

  const aresInstall = await resolveWebOsCli(rootDir, 'ares-install');
  if (!aresInstall) {
    fail(
      'LG webOS CLI is not installed. Install the ares tools, then rerun `npm run install:webos`.'
    );
  }

  const result = spawnSync(
    aresInstall,
    ['-d', deviceName, packagePath],
    {
      cwd: rootDir,
      stdio: 'inherit'
    }
  );

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
