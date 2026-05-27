import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { resolveWebOsCli } from './webos-cli.mjs';

const rootDir = process.cwd();
const appId = 'com.moontvplus.webos4';

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function main() {
  const deviceName = process.argv[2];
  if (!deviceName) {
    fail('Usage: npm run launch:webos -- <device-name>');
  }

  const aresLaunch = await resolveWebOsCli(rootDir, 'ares-launch');
  if (!aresLaunch) {
    fail(
      'LG webOS CLI is not installed. Install the ares tools, then rerun `npm run launch:webos`.'
    );
  }

  const result = spawnSync(
    aresLaunch,
    ['-d', deviceName, appId],
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
