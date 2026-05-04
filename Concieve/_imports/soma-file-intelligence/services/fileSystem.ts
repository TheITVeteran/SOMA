import { FileSystemNode, FileMetadata } from "../types";
import { SUPPORTED_TEXT_EXTENSIONS, MAX_FILE_SIZE_BYTES } from "../constants";

// Helper to generate a stable ID (simple mock hash)
const generateId = (path: string) => {
  let hash = 0;
  for (let i = 0; i < path.length; i++) {
    const char = path.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `node_${Math.abs(hash)}`;
};

/**
 * BACKEND INTEGRATION HOOK
 * Replace the internals of this function to upload files to your API
 * and return the processed FileSystemNode[] structure from the server.
 */
export const uploadFilesToBackend = async (files: File[]): Promise<FileSystemNode[]> => {
    // Example:
    // const formData = new FormData();
    // files.forEach(f => formData.append('files', f));
    // const res = await fetch('/api/ingest', { method: 'POST', body: formData });
    // return await res.json();
    
    // For now, we route to local processing
    return processFileList(files);
}

export const readDirectory = async (
  dirHandle: FileSystemDirectoryHandle,
  parentId: string | null = null,
  pathPrefix: string = ''
): Promise<FileSystemNode[]> => {
  const nodes: FileSystemNode[] = [];

  for await (const entry of dirHandle.values()) {
    const path = `${pathPrefix}/${entry.name}`;
    const id = generateId(path);

    if (entry.kind === 'file') {
      // Basic metadata extraction
      const fileHandle = entry as FileSystemFileHandle;
      const file = await fileHandle.getFile();
      
      const extension = entry.name.split('.').pop()?.toLowerCase() || '';
      const isSupported = SUPPORTED_TEXT_EXTENSIONS.includes(extension);

      let content = undefined;
      // Only read text content for the demo to save memory
      if (isSupported && file.size < MAX_FILE_SIZE_BYTES) {
        content = await file.text();
      }

      const metadata: FileMetadata = {
        size: file.size,
        lastModified: file.lastModified,
        type: file.type || 'application/octet-stream',
        extension,
        keywords: [],
      };

      nodes.push({
        id,
        name: entry.name,
        kind: 'file',
        path,
        handle: entry,
        parentId,
        metadata,
        content,
        isIndexed: false
      });

    } else if (entry.kind === 'directory') {
      const dirNode: FileSystemNode = {
        id,
        name: entry.name,
        kind: 'directory',
        path,
        handle: entry,
        parentId,
        isIndexed: false,
        children: [] 
      };
      
      // Recursively read children
      // In a real app with huge drives, we might do this lazily or in chunks
      // For this demo, we do a full scan but could be slow for massive folders
      const children = await readDirectory(entry as FileSystemDirectoryHandle, id, path);
      dirNode.children = children;
      nodes.push(dirNode);
    }
  }

  return nodes.sort((a, b) => {
      // Sort directories first, then files
      if (a.kind === b.kind) return a.name.localeCompare(b.name);
      return a.kind === 'directory' ? -1 : 1;
  });
};

export const processFileList = async (fileList: FileList | File[]): Promise<FileSystemNode[]> => {
  const rootChildren: FileSystemNode[] = [];
  
  // Helper to sort (duplicated from readDirectory for now)
  const sortNodes = (nodes: FileSystemNode[]) => {
      nodes.sort((a, b) => {
          if (a.kind === b.kind) return a.name.localeCompare(b.name);
          return a.kind === 'directory' ? -1 : 1;
      });
      nodes.forEach(n => {
          if (n.children) sortNodes(n.children);
      });
  };

  // Convert FileList to array if needed
  const files = Array.isArray(fileList) ? fileList : Array.from(fileList);

  // Iterate over the flat list of files
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    // Handle paths. Drop events often don't have webkitRelativePath.
    // If missing, we treat it as a root level file.
    let pathParts: string[] = [];
    if (file.webkitRelativePath) {
        pathParts = file.webkitRelativePath.split('/');
    } else {
        pathParts = [file.name];
    }
    
    // The first part is usually the Root Folder name if uploaded via folder picker,
    // but for Drag/Drop single files, it's just the filename.
    // We start processing.
    
    let currentLevel = rootChildren;
    let currentPathPrefix = "Upload"; 
    let parentId = generateId("Upload");

    // If it's a folder upload (path > 1), strictly follow structure. 
    // If it's loose files (path == 1), add to root.
    const startIndex = 0;

    for (let j = startIndex; j < pathParts.length; j++) {
        const part = pathParts[j];
        // If pathParts length is 1, it's just a file at root.
        // If pathParts length > 1, first might be root dir name, but we can just merge.
        
        const isFile = j === pathParts.length - 1;
        const fullPath = currentPathPrefix + '/' + part;
        const id = generateId(fullPath);

        if (isFile) {
            const extension = part.split('.').pop()?.toLowerCase() || '';
            const isSupported = SUPPORTED_TEXT_EXTENSIONS.includes(extension);
            let content = undefined;
            
            if (isSupported && file.size < MAX_FILE_SIZE_BYTES) {
                 content = await file.text();
            }

            currentLevel.push({
                id,
                name: part,
                kind: 'file',
                path: fullPath,
                parentId,
                isIndexed: false,
                metadata: {
                    size: file.size,
                    lastModified: file.lastModified,
                    type: file.type || 'application/octet-stream',
                    extension,
                    keywords: []
                },
                content
            });
        } else {
            // Check if directory node already exists at this level
            let dirNode = currentLevel.find(n => n.kind === 'directory' && n.name === part);
            if (!dirNode) {
                dirNode = {
                    id,
                    name: part,
                    kind: 'directory',
                    path: fullPath,
                    parentId,
                    isIndexed: false,
                    children: []
                };
                currentLevel.push(dirNode);
            }
            // Descend
            currentLevel = dirNode.children!;
            currentPathPrefix = fullPath;
            parentId = id;
        }
    }
  }
  
  sortNodes(rootChildren);
  return rootChildren;
};

export const flattenNodes = (nodes: FileSystemNode[]): FileSystemNode[] => {
    let flat: FileSystemNode[] = [];
    nodes.forEach(node => {
        flat.push(node);
        if (node.children) {
            flat = flat.concat(flattenNodes(node.children));
        }
    });
    return flat;
};