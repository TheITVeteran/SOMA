import path from 'path';

export function resolveWithinRoot(rootPath, candidatePath, label = 'Path', { allowRoot = false } = {}) {
    const root = path.resolve(rootPath);
    const resolved = path.resolve(root, candidatePath);
    const relative = path.relative(root, resolved);

    if ((!allowRoot && relative === '') || relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`${label} outside allowed root: ${candidatePath}`);
    }

    return resolved;
}

export function isWithinRoot(rootPath, candidatePath) {
    try {
        resolveWithinRoot(rootPath, candidatePath);
        return true;
    } catch {
        return false;
    }
}
