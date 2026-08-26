import { lstatSync } from 'node:fs';
import { lstat, readFile, readdir } from 'node:fs/promises';
import * as path from 'node:path';

import { ImplementationReadinessError, type ImplementationReadinessRepository } from './ImplementationReadinessTypes';

function safeRelativePath(value: string): string {
  if (
    value.length === 0 ||
    value.includes('\0') ||
    value.includes('\\') ||
    path.posix.isAbsolute(value) ||
    value.split('/').some((component) => component.length === 0 || component === '.' || component === '..')
  ) {
    throw new ImplementationReadinessError('IMPLEMENTATION_CONTRACT_INVALID', 'repository-path');
  }
  return value;
}

/** Reads repository contracts without following symlinks or escaping the selected workspace. */
export class NodeImplementationReadinessRepository implements ImplementationReadinessRepository {
  private readonly root: string;

  public constructor(workspaceRoot: string) {
    const resolved = path.resolve(workspaceRoot);
    const metadata = lstatSync(resolved);
    if (
      !path.isAbsolute(workspaceRoot) ||
      resolved === path.parse(resolved).root ||
      !metadata.isDirectory() ||
      metadata.isSymbolicLink()
    ) {
      throw new ImplementationReadinessError('IMPLEMENTATION_CONTRACT_INVALID', 'workspace-root');
    }
    this.root = resolved;
  }

  public async readText(relativePath: string): Promise<string> {
    const { metadata, target } = await this.inspect(relativePath);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new ImplementationReadinessError('IMPLEMENTATION_CONTRACT_INVALID', 'repository-file');
    }
    return await readFile(target, 'utf8');
  }

  public async listFiles(relativeRoot: string): Promise<readonly string[]> {
    const { metadata, target: root } = await this.inspect(relativeRoot);
    if (!metadata.isDirectory()) {
      throw new ImplementationReadinessError('IMPLEMENTATION_CONTRACT_INVALID', 'repository-tree');
    }
    const files: string[] = [];
    await this.walk(root, '', files);
    return Object.freeze(files.sort((left, right) => left.localeCompare(right, 'en')));
  }

  private async inspect(relativePath: string): Promise<{
    readonly metadata: Awaited<ReturnType<typeof lstat>>;
    readonly target: string;
  }> {
    const safe = safeRelativePath(relativePath);
    const target = path.resolve(this.root, ...safe.split('/'));
    const child = path.relative(this.root, target);
    if (child.length === 0 || child.startsWith('..') || path.isAbsolute(child)) {
      throw new ImplementationReadinessError('IMPLEMENTATION_CONTRACT_INVALID', 'repository-path');
    }
    let current = this.root;
    let metadata: Awaited<ReturnType<typeof lstat>> | null = null;
    const components = safe.split('/');
    for (const [index, component] of components.entries()) {
      current = path.join(current, component);
      metadata = await lstat(current);
      if (metadata.isSymbolicLink() || (index < components.length - 1 && !metadata.isDirectory())) {
        throw new ImplementationReadinessError('IMPLEMENTATION_CONTRACT_INVALID', 'repository-path');
      }
    }
    if (!metadata) throw new ImplementationReadinessError('IMPLEMENTATION_CONTRACT_INVALID', 'repository-path');
    return Object.freeze({ metadata, target });
  }

  private async walk(root: string, prefix: string, files: string[]): Promise<void> {
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink() || (!entry.isDirectory() && !entry.isFile())) {
        throw new ImplementationReadinessError('IMPLEMENTATION_CONTRACT_INVALID', 'repository-tree');
      }
      const relativePath = path.posix.join(prefix, entry.name);
      if (entry.isDirectory()) await this.walk(path.join(root, entry.name), relativePath, files);
      else files.push(relativePath);
    }
  }
}
