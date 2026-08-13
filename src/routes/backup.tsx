import { useState, useEffect, useCallback, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { Download, Database, HardDrive, Trash2, RotateCcw, FolderOpen, Clock, Upload } from "lucide-react";
import { dateShort } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { BackupFolderDialog } from "@/components/backup/BackupFolderDialog";
import { saveFileToDisk, isDesktop } from "@/lib/platform";

export const Route = createFileRoute("/backup")({
  head: () => ({ meta: [{ title: "Backup — UDYANA" }] }),
  component: BackupPage,
});

type BackupRecord = { id: number; type: string; createdAt: string; size: number; tables?: string; filename?: string };

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function BackupPage() {
  const { can } = useAuth();
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [backupFolder, setBackupFolder] = useState(() => localStorage.getItem("udyana_backup_folder") || ".udyana-backups");
  const [autoBackup, setAutoBackup] = useState(() => localStorage.getItem("udyana_auto_backup") !== "false");
  const [nextBackupIn, setNextBackupIn] = useState("");
  const [importTarget, setImportTarget] = useState<{ name: string; text: string; tables: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const data = await api.safeGet<BackupRecord[]>("/api/backup/snapshots");
      setBackups(data || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const doExport = useCallback(async (): Promise<Blob | null> => {
    try {
      const token = localStorage.getItem("udyana_token");
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/backup/export`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export failed");
      return await res.blob();
    } catch (err: any) {
      toast.error(err.message || "Export failed");
      return null;
    }
  }, []);

  const runAutoBackup = useCallback(async () => {
    try {
      await api.post("/api/backup/snapshot");
      localStorage.setItem("udyana_last_auto_backup", Date.now().toString());
      const now = new Date();
      const label = now.toLocaleString();
      localStorage.setItem("udyana_last_auto_backup_label", label);
      const folder = localStorage.getItem("udyana_backup_folder");
      if (folder && folder !== ".udyana-backups") {
        const blob = await doExport();
        if (blob) {
          const fileName = `backup-${now.toISOString().slice(0, 10)}.json`;
          await saveFileToDisk(fileName, blob, folder);
        }
      }
      fetchData();
    } catch { /* silent */ }
  }, [fetchData, doExport]);

  useEffect(() => {
    if (!autoBackup) return;
    const lastBackup = Number(localStorage.getItem("udyana_last_auto_backup")) || 0;
    if (Date.now() - lastBackup >= 43_200_000) {
      runAutoBackup();
    }
    const id = setInterval(() => {
      const last = Number(localStorage.getItem("udyana_last_auto_backup")) || 0;
      if (Date.now() - last >= 43_200_000) {
        runAutoBackup();
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [autoBackup, runAutoBackup]);

  useEffect(() => {
    if (!autoBackup) { setNextBackupIn(""); return; }
    const update = () => {
      const last = Number(localStorage.getItem("udyana_last_auto_backup")) || 0;
      const elapsed = Date.now() - last;
      const remaining = Math.max(0, 43_200_000 - elapsed);
      const hrs = Math.floor(remaining / 3_600_000);
      const mins = Math.floor((remaining % 3_600_000) / 60_000);
      setNextBackupIn(hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`);
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [autoBackup]);

  const toggleAutoBackup = () => {
    const next = !autoBackup;
    setAutoBackup(next);
    localStorage.setItem("udyana_auto_backup", next ? "true" : "false");
    if (next) {
      toast.success("Auto-backup enabled (every 12 hours)");
    } else {
      toast.success("Auto-backup disabled");
    }
  };

  const exportBackup = async () => {
    const blob = await doExport();
    if (!blob) return;
    const fileName = `backup-${new Date().toISOString().slice(0, 10)}.json`;
    const folder = localStorage.getItem("udyana_backup_folder");
    try {
      if (isDesktop()) {
        const targetFolder = folder && folder !== ".udyana-backups" ? folder : ".udyana-backups";
        await saveFileToDisk(fileName, blob, targetFolder);
        toast.success(targetFolder === ".udyana-backups" ? "Backup saved" : `Backup saved to ${targetFolder}/${fileName}`);
      } else {
        await saveFileToDisk(fileName, blob);
        toast.success("Backup downloaded");
      }
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save backup");
    }
  };

  const createSnapshot = async () => {
    try {
      await api.post("/api/backup/snapshot");
      toast.success("Snapshot saved");
      fetchData();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const deleteBackup = async (id: number) => {
    try {
      await api.delete(`/api/backup/${id}`);
      toast.success("Deleted");
      fetchData();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const handleFolderChange = (folder: string) => {
    setBackupFolder(folder);
    localStorage.setItem("udyana_backup_folder", folder);
    toast.success(`Backup folder changed to "${folder}"`);
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("bad shape");
        const tables = Object.keys(parsed).length;
        if (!tables) throw new Error("empty backup");
        setImportTarget({ name: file.name, text: String(reader.result), tables });
      } catch {
        toast.error("Invalid backup file: expected a JSON backup exported from UDYANA");
      }
    };
    reader.readAsText(file);
  };

  const runImport = async () => {
    if (!importTarget) return;
    setImporting(true);
    try {
      const token = localStorage.getItem("udyana_token");
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/backup/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: importTarget.text,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || "Import failed");
      }
      const result = await res.json();
      toast.success(result?.message || "Backup restored");
      setImportTarget(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <AppShell title="Backup & Restore">
      <PageContainer>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-4xl mb-4">
          {can("backup", "export") && (
            <div className="bg-card border border-border rounded-md p-4">
              <div className="flex items-center gap-2 mb-2"><Download className="size-4 text-primary" /><h3 className="font-semibold text-sm">Export</h3></div>
              <p className="text-xs text-muted-foreground mb-3">Download a JSON file of all data.</p>
              <Button size="sm" onClick={exportBackup}>Download backup</Button>
            </div>
          )}
          {can("backup", "create") && (
            <div className="bg-card border border-border rounded-md p-4">
              <div className="flex items-center gap-2 mb-2"><Upload className="size-4 text-primary" /><h3 className="font-semibold text-sm">Import</h3></div>
              <p className="text-xs text-muted-foreground mb-3">Restore data from a downloaded backup file.</p>
              <input ref={importInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImportFileChange} />
              <Button size="sm" variant="secondary" onClick={() => importInputRef.current?.click()} className="gap-1.5"><Upload className="size-3.5" />Restore from backup</Button>
            </div>
          )}
          {can("backup", "create") && (
            <div className="bg-card border border-border rounded-md p-4">
              <div className="flex items-center gap-2 mb-2"><Database className="size-4 text-primary" /><h3 className="font-semibold text-sm">Snapshot</h3></div>
              <p className="text-xs text-muted-foreground mb-3">Save a snapshot on the server.</p>
              <Button size="sm" variant="secondary" onClick={createSnapshot}>Save snapshot now</Button>
            </div>
          )}
          {can("backup", "export") && (
            <div className="bg-card border border-border rounded-md p-4">
              <div className="flex items-center gap-2 mb-2"><FolderOpen className="size-4 text-primary" /><h3 className="font-semibold text-sm">Backup Folder</h3></div>
              <p className="text-xs text-muted-foreground mb-1">Backups are saved to:</p>
              <p className="text-xs font-mono text-foreground mb-3 truncate">{backupFolder}</p>
              <Button size="sm" variant="outline" onClick={() => setFolderDialogOpen(true)} className="gap-1.5"><FolderOpen className="size-3.5" />Change Folder</Button>
            </div>
          )}
          {can("backup", "create") && (
            <div className="bg-card border border-border rounded-md p-4">
              <div className="flex items-center gap-2 mb-2"><Clock className="size-4 text-primary" /><h3 className="font-semibold text-sm">Auto Backup</h3></div>
              <p className="text-xs text-muted-foreground mb-1">Automatically save a snapshot every 12 hours.</p>
              {autoBackup && nextBackupIn && (
                <p className="text-xs font-mono text-muted-foreground mb-3">Next backup in {nextBackupIn}</p>
              )}
              <Button size="sm" variant={autoBackup ? "secondary" : "outline"} onClick={toggleAutoBackup} className="gap-1.5">
                <Clock className="size-3.5" />{autoBackup ? "On" : "Off"}
              </Button>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-md max-w-4xl">
          <div className="px-4 py-2.5 border-b border-border text-sm font-semibold flex items-center gap-2"><HardDrive className="size-4 text-muted-foreground" />Saved Backups</div>
          {backups.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">{loading ? "Loading..." : "No backups yet."}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Date</th><th>Size</th><th>Type</th><th>Tables</th><th className="w-24 text-right">Actions</th></tr></thead>
                <tbody>
                  {backups.map((b) => (
                    <tr key={b.id}>
                      <td className="font-medium">{dateShort(b.createdAt)}</td>
                      <td className="tabular-nums text-muted-foreground">{formatSize(b.size)}</td>
                      <td>{b.type === "file" ? <span className="inline-flex items-center gap-1 text-xs bg-blue-500/10 text-blue-600 border border-blue-500/20 rounded px-2 py-0.5"><Download className="size-2.5" />File</span> : <span className="inline-flex items-center gap-1 text-xs bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded px-2 py-0.5"><Database className="size-2.5" />Snapshot</span>}</td>
                      <td className="text-xs text-muted-foreground">{b.tables}</td>
                      <td className="text-right">
                        {can("backup", "delete") && <button onClick={() => setDeleteTarget(b.id)} className="size-7 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive inline-grid place-items-center" title="Delete"><Trash2 className="size-3.5" /></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PageContainer>

      <AlertDialog open={deleteTarget != null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete backup?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { if (deleteTarget) { deleteBackup(deleteTarget); setDeleteTarget(null); } }}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={importTarget != null} onOpenChange={() => !importing && setImportTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore backup?</AlertDialogTitle>
            <AlertDialogDescription>
              This will <strong>replace all current data</strong> (customers, orders, inventory, users, settings, etc.) with the contents of{" "}
              <span className="font-mono text-foreground">{importTarget?.name}</span> ({importTarget?.tables} tables).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={importing}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={importing} onClick={runImport}>{importing ? "Restoring..." : "Restore"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BackupFolderDialog
        open={folderDialogOpen}
        onOpenChange={setFolderDialogOpen}
        currentFolder={backupFolder}
        onFolderChange={handleFolderChange}
      />
    </AppShell>
  );
}
