import path from 'node:path';

function projectRoot(): string {
  const cwd = process.cwd();
  return path.basename(cwd) === 'web' && path.basename(path.dirname(cwd)) === 'apps'
    ? path.resolve(cwd, '..', '..')
    : cwd;
}

const configuredStorage = process.env.ARTIFACT_STORAGE_DIR ?? 'artifacts-storage';
export const ARTIFACTS_ROOT = path.resolve(projectRoot(), configuredStorage);

export function resolveArtifactPath(storageKey: string): string | null {
  const filePath = path.resolve(ARTIFACTS_ROOT, storageKey);
  const rootPrefix = `${ARTIFACTS_ROOT}${path.sep}`;
  return filePath.startsWith(rootPrefix) ? filePath : null;
}
