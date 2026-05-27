import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch (error) {
    return false;
  }
}

export async function resolveWebOsCli(rootDir, commandName) {
  const localCommandPath = path.join(rootDir, 'node_modules', '.bin', commandName);
  if (await exists(localCommandPath)) {
    return localCommandPath;
  }

  const which = spawnSync('bash', ['-lc', 'command -v ' + commandName], {
    cwd: rootDir,
    encoding: 'utf8'
  });

  if (which.status === 0 && which.stdout.trim()) {
    return which.stdout.trim();
  }

  return '';
}
