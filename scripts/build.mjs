import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const hostedSrcDir = path.join(rootDir, 'hosted');
const launcherSrcDir = path.join(rootDir, 'launcher');
const hostedDistDir = path.join(distDir, 'hosted');
const launcherDistDir = path.join(distDir, 'launcher');
const moonTvPublicDir = path.join(distDir, 'moontvplus-public', 'tv');
const hlsAssetSourcePath = path.join(rootDir, 'node_modules', 'hls.js', 'dist', 'hls.min.js');

async function removeDir(target) {
  await fs.rm(target, { recursive: true, force: true });
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

async function copyFile(source, target) {
  await ensureDir(path.dirname(target));
  await fs.copyFile(source, target);
}

async function writeLauncherConfig(targetDir) {
  const configPath = path.join(targetDir, 'launcher-config.json');
  const configuredUrl = (process.env.WEBOS_APP_URL || '').trim();
  const payload = {
    defaultUrl: configuredUrl,
    autoLaunch: Boolean(configuredUrl),
    lastBuiltAt: new Date().toISOString()
  };

  await fs.writeFile(configPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

async function main() {
  await removeDir(distDir);
  await ensureDir(distDir);
  await copyDir(hostedSrcDir, hostedDistDir);
  await copyDir(hostedSrcDir, moonTvPublicDir);
  await copyFile(hlsAssetSourcePath, path.join(hostedDistDir, 'vendor', 'hls.min.js'));
  await copyFile(hlsAssetSourcePath, path.join(moonTvPublicDir, 'vendor', 'hls.min.js'));
  await copyDir(launcherSrcDir, launcherDistDir);
  await writeLauncherConfig(launcherDistDir);

  console.log('Build complete.');
  console.log('Hosted frontend:', path.relative(rootDir, hostedDistDir));
  console.log('MoonTVPlus public payload:', path.relative(rootDir, moonTvPublicDir));
  console.log('webOS launcher:', path.relative(rootDir, launcherDistDir));
  if (process.env.WEBOS_APP_URL) {
    console.log('Launcher default URL:', process.env.WEBOS_APP_URL);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
