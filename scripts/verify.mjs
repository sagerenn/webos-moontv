import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import vm from 'node:vm';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const rootDir = process.cwd();
const execFileAsync = promisify(execFile);

async function readJson(relativePath) {
  const content = await fs.readFile(path.join(rootDir, relativePath), 'utf8');
  return JSON.parse(content);
}

async function assertExists(relativePath) {
  await fs.access(path.join(rootDir, relativePath));
}

async function assertParses(relativePath) {
  const source = await fs.readFile(path.join(rootDir, relativePath), 'utf8');
  new vm.Script(source, { filename: relativePath });
}

async function assertBuildOutput() {
  const requiredBuiltFiles = [
    'dist/hosted/index.html',
    'dist/hosted/styles.css',
    'dist/hosted/app.js',
    'dist/hosted/vendor/hls.min.js',
    'dist/moontvplus-public/tv/index.html',
    'dist/moontvplus-public/tv/styles.css',
    'dist/moontvplus-public/tv/app.js',
    'dist/moontvplus-public/tv/vendor/hls.min.js',
    'dist/launcher/appinfo.json',
    'dist/launcher/index.html',
    'dist/launcher/styles.css',
    'dist/launcher/launcher.js',
    'dist/launcher/launcher-config.json'
  ];

  for (const relativePath of requiredBuiltFiles) {
    await assertExists(relativePath);
  }

  const packagedLauncherConfig = await readJson('dist/launcher/launcher-config.json');
  if (typeof packagedLauncherConfig.defaultUrl !== 'string') {
    throw new Error('dist/launcher/launcher-config.json must contain a string defaultUrl field.');
  }
  if (typeof packagedLauncherConfig.autoLaunch !== 'boolean') {
    throw new Error('dist/launcher/launcher-config.json must contain a boolean autoLaunch field.');
  }
}

async function assertHostedSmoke() {
  await execFileAsync('node', ['scripts/smoke-hosted.mjs'], {
    cwd: rootDir
  });
}

async function maybeVerifyPackagedLauncherConfig() {
  const ipkFiles = (await fs.readdir(rootDir)).filter((file) => file.endsWith('.ipk'));
  if (!ipkFiles.length) {
    return;
  }

  const latestIpk = ipkFiles.sort().slice(-1)[0];
  const script = `
import os, tarfile, tempfile, subprocess, json
ipk = ${JSON.stringify(path.join(rootDir, latestIpk))}
with tempfile.TemporaryDirectory() as d:
    subprocess.run(['ar', 'x', ipk], cwd=d, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    with tarfile.open(os.path.join(d, 'data.tar.gz'), 'r:gz') as t:
        member = 'usr/palm/applications/com.moontvplus.webos4/launcher-config.json'
        data = json.loads(t.extractfile(member).read().decode())
        print(json.dumps(data))
`;

  const { stdout } = await execFileAsync('python3', ['-c', script], {
    cwd: rootDir
  });

  const parsed = JSON.parse(stdout.trim());
  if (typeof parsed.defaultUrl !== 'string') {
    throw new Error('Packaged launcher-config.json is missing defaultUrl.');
  }
  if (typeof parsed.autoLaunch !== 'boolean') {
    throw new Error('Packaged launcher-config.json is missing autoLaunch.');
  }
}

async function main() {
  const requiredFiles = [
    'package.json',
    'hosted/index.html',
    'hosted/styles.css',
    'hosted/app.js',
    'launcher/appinfo.json',
    'launcher/index.html',
    'launcher/styles.css',
    'launcher/launcher.js',
    'launcher/launcher-config.json',
    'scripts/build.mjs',
    'scripts/install-into-moontvplus.mjs',
    'scripts/smoke-hosted.mjs',
    'scripts/package-webos.mjs',
    'scripts/validate-deploy.mjs',
    'scripts/install-webos.mjs',
    'scripts/launch-webos.mjs'
  ];

  for (const relativePath of requiredFiles) {
    await assertExists(relativePath);
  }

  const launcherAppInfo = await readJson('launcher/appinfo.json');
  if (!launcherAppInfo.id || !launcherAppInfo.main || !launcherAppInfo.title) {
    throw new Error('launcher/appinfo.json is missing required webOS metadata.');
  }

  const launcherConfig = await readJson('launcher/launcher-config.json');
  if (typeof launcherConfig.defaultUrl !== 'string') {
    throw new Error('launcher/launcher-config.json must contain a string defaultUrl field.');
  }
  if (typeof launcherConfig.autoLaunch !== 'boolean') {
    throw new Error('launcher/launcher-config.json must contain a boolean autoLaunch field.');
  }

  await assertParses('hosted/app.js');
  await assertParses('launcher/launcher.js');
  await assertBuildOutput();
  await assertHostedSmoke();
  await maybeVerifyPackagedLauncherConfig();

  console.log('Verification complete.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
