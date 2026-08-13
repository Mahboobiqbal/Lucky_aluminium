import { useState, useEffect } from "react";
import { FolderOpen, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { folderExists, isDesktop, pickDirectory, supportsBrowserDirectoryPicker } from "@/lib/platform";

interface BackupFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFolder: string;
  onFolderChange: (folder: string) => void;
}

export function BackupFolderDialog({
  open,
  onOpenChange,
  currentFolder,
  onFolderChange,
}: BackupFolderDialogProps) {
  const [folderPath, setFolderPath] = useState(currentFolder);
  const [isValidPath, setIsValidPath] = useState(true);
  const [showDefaultWarning, setShowDefaultWarning] = useState(false);

  useEffect(() => {
    setFolderPath(currentFolder);
    setShowDefaultWarning(currentFolder === ".udyana-backups");
  }, [currentFolder]);

  useEffect(() => {
    if (!folderPath || folderPath === ".udyana-backups") {
      setIsValidPath(true);
      return;
    }
    let cancelled = false;
    folderExists(folderPath).then((exists) => {
      if (!cancelled) setIsValidPath(exists);
    });
    return () => {
      cancelled = true;
    };
  }, [folderPath]);

  const handleOpenDirectoryPicker = async () => {
    if (!isDesktop() && !supportsBrowserDirectoryPicker()) {
      toast.error("Folder browsing is not supported in this browser. Type the path manually.");
      return;
    }
    const selected = await pickDirectory();
    if (selected) {
      setFolderPath(selected);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="size-5" />
            Backup Folder
          </DialogTitle>
          <DialogDescription>
            Choose where to save your backups. If the folder doesn't exist yet, it will be created
            automatically when the first backup is saved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="folderPath">Folder Path</Label>
            <div className="flex gap-2 mt-1.5">
              <Input
                id="folderPath"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                placeholder="Enter backup folder path"
                className={`font-mono text-sm ${!isValidPath && folderPath ? "border-destructive" : ""}`}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenDirectoryPicker}
                className="shrink-0"
              >
                Browse
              </Button>
            </div>
          </div>

          {folderPath && !isValidPath && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div className="text-xs">
                <strong>Folder not found:</strong> The specified folder doesn't exist on this system.
                Check the path or use Browse to pick an existing folder.
              </div>
            </div>
          )}

          {showDefaultWarning && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400">
              <Check className="size-4 shrink-0 mt-0.5" />
              <div className="text-xs">
                <strong>Default location:</strong> Backups are saved to the ".udyana-backups" folder in
                the app's data directory.
              </div>
            </div>
          )}

          {!isDesktop() && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-400">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div className="text-xs">
                <strong>Browser mode:</strong> Picking a folder keeps backups in that folder for this
                session. In the installed desktop app, the folder is remembered permanently.
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => { onFolderChange(folderPath); onOpenChange(false); }}
            disabled={!isValidPath && !!folderPath}
            className="gap-2"
          >
            <Check className="size-3.5" />
            Confirm Folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
