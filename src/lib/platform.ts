export function isElectron(): boolean {
  return typeof window !== "undefined" && "electronAPI" in window;
}

export function isDesktop(): boolean {
  return isElectron();
}

const api = () => (typeof window !== "undefined" ? (window as any).electronAPI : null);

let browserDirHandle: FileSystemDirectoryHandle | null = null;

export function getBrowserDirHandle(): FileSystemDirectoryHandle | null {
  return browserDirHandle;
}

export function supportsBrowserDirectoryPicker(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export async function pickDirectory(): Promise<string | null> {
  const e = api();
  if (e?.pickDirectory) {
    try {
      return await e.pickDirectory();
    } catch (err) {
      console.warn("Folder picker failed", err);
      return null;
    }
  }
  if (supportsBrowserDirectoryPicker()) {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
      browserDirHandle = handle;
      return handle.name;
    } catch {
      return null;
    }
  }
  return null;
}

export async function saveFileToDisk(filePath: string, data: Blob | ArrayBuffer, folder?: string): Promise<void> {
  const e = api();
  if (e?.saveFile) {
    const buf = data instanceof Blob ? await data.arrayBuffer() : data;
    const cleanFolder = folder ? folder.replace(/[\\/]+$/, "") : "";
    const fullPath = cleanFolder ? `${cleanFolder}/${filePath}` : filePath;
    const result = await e.saveFile(fullPath, buf);
    if (result && result.ok === false) {
      throw new Error(result.error || "Failed to save file");
    }
    return;
  }
  const blob = data instanceof Blob ? data : new Blob([data]);
  if (browserDirHandle) {
    const fileHandle = await browserDirHandle.getFileHandle(filePath.split("/").pop() || "download", { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filePath.split("/").pop() || "download";
  a.click();
  URL.revokeObjectURL(url);
}

export async function folderExists(folderPath: string): Promise<boolean> {
  const e = api();
  if (e?.folderExists) {
    try {
      const result = await e.folderExists(folderPath);
      return !!(result && result.ok);
    } catch {
      return false;
    }
  }
  return true;
}

export async function readFileFromDisk(filePath: string): Promise<ArrayBuffer | null> {
  const e = api();
  if (e?.readFile) return e.readFile(filePath);
  return null;
}
