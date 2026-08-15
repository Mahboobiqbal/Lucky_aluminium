import { createFileRoute } from "@tanstack/react-router";
import { api, type UserPermission } from "@/lib/api";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { TableShell } from "@/components/layout/TableShell";
import { EmptyState } from "@/components/layout/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth";
import { Plus, Pencil, Trash2, Search, Shield, X, Eye, EyeOff, Check, Ban, CheckSquare, Square, Users } from "lucide-react";
import { toast } from "sonner";
import { dateShort } from "@/lib/format";
import { useState, useEffect, useCallback } from "react";

export const Route = createFileRoute("/access-control")({
  head: () => ({ meta: [{ title: "Access Control — UDYANA" }] }),
  component: AccessControlPage,
});

const MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "customers", label: "Customers" },
  { key: "quotations", label: "Quotations" },
  { key: "orders", label: "Orders" },
  { key: "invoices", label: "Customer Invoices" },
  { key: "payments", label: "Payments" },
  { key: "paymentReceipts", label: "Payment Receipts" },
  { key: "purchase", label: "Purchase" },
  { key: "suppliers", label: "Suppliers" },
  { key: "products", label: "Products" },
  { key: "measurements", label: "Measurements" },
  { key: "inventory", label: "Inventory" },
  { key: "expenses", label: "Expenses" },
  { key: "reports", label: "Reports" },
  { key: "dailyPaymentStatement", label: "Daily Payment Statement" },
  { key: "settings", label: "Settings" },
  { key: "backup", label: "Backup" },
] as const;

type FieldName = "canView" | "canCreate" | "canEdit" | "canDelete" | "canPrint" | "canExport";

const FIELD_LABELS: { key: FieldName; label: string }[] = [
  { key: "canView", label: "View" },
  { key: "canCreate", label: "Create" },
  { key: "canEdit", label: "Edit" },
  { key: "canDelete", label: "Delete" },
  { key: "canPrint", label: "Print" },
  { key: "canExport", label: "Export" },
];

type ApiUser = {
  id: number;
  fullName: string;
  username: string;
  email: string;
  phone: string;
  status: string;
  role: string;
  createdAt: string;
};

type ApiUserWithPerms = ApiUser & {
  permissions: UserPermission[];
};

const emptyForm: {
  fullName: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  status: string;
  role: string;
} = {
  fullName: "",
  username: "",
  email: "",
  phone: "",
  password: "",
  status: "active",
  role: "manager",
};

function AccessControlPage() {
  const { refreshPermissions, currentUser } = useAuth();
  const [q, setQ] = useState("");
  const [userOpen, setUserOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<ApiUserWithPerms | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ moduleKey: string; field: FieldName; grant: boolean } | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState<{ moduleKey: string; grant: boolean } | null>(null);
  const [allConfirm, setAllConfirm] = useState<{ grant: boolean } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await api.safeGet<ApiUser[]>("/api/users");
      setUsers(data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filtered = q
    ? users.filter((u) =>
        [u.fullName, u.username, u.email, u.role].some((v) =>
          v?.toLowerCase().includes(q.toLowerCase()),
        ),
      )
    : users;

  const openNew = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowPw(false);
    setUserOpen(true);
  };

  const openEdit = async (u: ApiUser) => {
    try {
      const full = await api.safeGet<ApiUserWithPerms>(`/api/users/${u.id}`);
      if (!full) return;
      setForm({
        fullName: full.fullName,
        username: full.username,
        email: full.email,
        phone: full.phone,
        password: "",
        status: full.status,
        role: full.role,
      });
      setEditingId(full.id);
      setShowPw(false);
      setUserOpen(true);
    } catch {}
  };

  const saveUser = async () => {
    if (!form.fullName.trim() || !form.username.trim()) {
      return toast.error("Name and username are required");
    }
    if (!editingId && !form.password.trim()) {
      return toast.error("Password is required for new users");
    }
    if (!editingId && form.password.length < 4) {
      return toast.error("Password must be at least 4 characters");
    }

    try {
      if (editingId) {
        const body: any = {
          id: editingId,
          fullName: form.fullName,
          username: form.username,
          email: form.email,
          phone: form.phone,
          status: form.status,
          role: form.role,
          permissions: selectedUser?.permissions?.map((p) => ({
            moduleKey: p.moduleKey,
            canView: p.canView,
            canCreate: p.canCreate,
            canEdit: p.canEdit,
            canDelete: p.canDelete,
            canPrint: p.canPrint,
            canExport: p.canExport,
          })) || [],
        };
        if (form.password) body.password = form.password;
        await api.put(`/api/users/${editingId}`, body);
        toast.success("User updated");
      } else {
        const defaultPerms = MODULES.map((m) => ({
          moduleKey: m.key,
          canView: true,
          canCreate: true,
          canEdit: true,
          canDelete: true,
          canPrint: true,
          canExport: true,
        }));
        await api.post("/api/users", {
          fullName: form.fullName,
          username: form.username,
          email: form.email,
          phone: form.phone,
          password: form.password,
          status: form.status,
          role: form.role,
          permissions: defaultPerms,
        });
        toast.success("User created");
      }
      setUserOpen(false);
      fetchUsers();
      if (selectedUser) refreshSelectedUser(selectedUser.id);
    } catch (err: any) {
      toast.error(err.message || "Failed to save user");
    }
  };

  const removeUser = async (id: number) => {
    try {
      await api.delete(`/api/users/${id}`);
      toast.success("User deleted");
      if (selectedUser?.id === id) setSelectedUser(null);
      fetchUsers();
      refreshPermissions();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user");
    }
  };

  const refreshSelectedUser = async (userId: number) => {
    try {
      const full = await api.safeGet<ApiUserWithPerms>(`/api/users/${userId}`);
      if (full) setSelectedUser(full);
    } catch {}
  };

  const toggleAction = async (moduleKey: string, field: FieldName, grant: boolean) => {
    if (!selectedUser?.id) return;

    const updatedPerms = (selectedUser.permissions || []).filter((p) => p.moduleKey !== moduleKey);
    const existing = selectedUser.permissions?.find((p) => p.moduleKey === moduleKey);

    if (existing) {
      updatedPerms.push({ ...existing, [field]: grant });
    } else {
      const base: any = { moduleKey, canView: false, canCreate: false, canEdit: false, canDelete: false, canPrint: false, canExport: false };
      base[field] = grant;
      updatedPerms.push({ id: 0, userId: selectedUser.id, ...base });
    }

    try {
      await api.put(`/api/permissions/user/${selectedUser.id}`, updatedPerms);
      refreshSelectedUser(selectedUser.id);
      refreshPermissions();
    } catch (err: any) {
      toast.error(err.message || "Failed to update permission");
    }
  };

  const bulkToggleModule = async (moduleKey: string, grant: boolean) => {
    if (!selectedUser?.id) return;

    const updatedPerms = (selectedUser.permissions || []).filter((p) => p.moduleKey !== moduleKey);
    updatedPerms.push({
      id: 0,
      userId: selectedUser.id,
      moduleKey,
      canView: grant,
      canCreate: grant,
      canEdit: grant,
      canDelete: grant,
      canPrint: grant,
      canExport: grant,
    });

    try {
      await api.put(`/api/permissions/user/${selectedUser.id}`, updatedPerms);
      const modLabel = MODULES.find((m) => m.key === moduleKey)?.label || moduleKey;
      toast.success(`${grant ? "Allowed all" : "Denied all"} for ${modLabel}`);
      refreshSelectedUser(selectedUser.id);
      refreshPermissions();
    } catch (err: any) {
      toast.error(err.message || "Failed to update permissions");
    }
  };

  const toggleAllModules = async (grant: boolean) => {
    if (!selectedUser?.id) return;

    const updatedPerms = MODULES.map((m) => ({
      id: 0,
      userId: selectedUser.id,
      moduleKey: m.key,
      canView: grant,
      canCreate: grant,
      canEdit: grant,
      canDelete: grant,
      canPrint: grant,
      canExport: grant,
    }));

    try {
      await api.put(`/api/permissions/user/${selectedUser.id}`, updatedPerms);
      toast.success(`${grant ? "Allowed all access" : "Denied all access"}`);
      refreshSelectedUser(selectedUser.id);
      refreshPermissions();
    } catch (err: any) {
      toast.error(err.message || "Failed to update permissions");
    }
  };

  const selectUser = async (u: ApiUser) => {
    try {
      const full = await api.safeGet<ApiUserWithPerms>(`/api/users/${u.id}`);
      if (full) setSelectedUser(full);
    } catch {}
  };

  return (
    <AppShell
      title="Access Control"
      actions={
        <div className="flex items-center gap-2 w-full">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search users..."
              className="h-8 pl-8 w-64 text-sm"
            />
          </div>
          <div className="ml-auto">
            <Button size="sm" onClick={openNew}>
              <Plus className="size-3.5 mr-1" />
              New User
            </Button>
          </div>
        </div>
      }
    >
      <PageContainer>
        {/* User list */}
        <TableShell>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th className="w-36 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr
                  key={u.id}
                  className={`cursor-pointer ${selectedUser?.id === u.id ? "bg-accent/50" : "hover:bg-accent/30"}`}
                  onClick={() => selectUser(u)}
                >
                  <td className="font-medium">{u.fullName}</td>
                  <td className="font-mono text-xs text-muted-foreground">{u.username}</td>
                  <td className="text-muted-foreground">{u.email || "—"}</td>
                  <td>
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium border ${
                      u.role === "admin"
                        ? "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30"
                        : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                    }`}>
                      {u.role === "admin" ? "Admin" : "Manager"}
                    </span>
                  </td>
                  <td>
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] border ${
                      u.status === "active"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                    }`}>
                      {u.status === "active" ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="text-muted-foreground">{dateShort(u.createdAt)}</td>
                  <td className="text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); selectUser(u); }}
                      className="size-7 rounded hover:bg-accent text-muted-foreground hover:text-foreground inline-grid place-items-center"
                      title="Manage permissions"
                    >
                      <Shield className="size-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(u); }}
                      className="size-7 rounded hover:bg-accent text-muted-foreground hover:text-foreground inline-grid place-items-center"
                      title="Edit user"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    {u.id !== currentUser?.id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(u.id); }}
                        className="size-7 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive inline-grid place-items-center"
                        title="Delete user"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <EmptyState icon={Users} title={loading ? "Loading users..." : "No users found"} hint={loading ? "Please wait" : "Add your first user to get started"} />}
        </TableShell>

        {/* Permissions panel */}
        {selectedUser && (
          <TableShell>
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Shield className="size-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Permissions — {selectedUser.fullName}</span>
                <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium border ${
                  selectedUser.role === "admin"
                    ? "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30"
                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                }`}>
                  {selectedUser.role === "admin" ? "Admin" : "Manager"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {selectedUser.role !== "admin" && (
                  <>
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setAllConfirm({ grant: true })}>
                      <Check className="size-3 mr-1" />Allow All
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px] text-destructive" onClick={() => setAllConfirm({ grant: false })}>
                      <Ban className="size-3 mr-1" />Deny All
                    </Button>
                  </>
                )}
                <button
                  onClick={() => setSelectedUser(null)}
                  className="size-7 rounded hover:bg-accent text-muted-foreground hover:text-foreground inline-grid place-items-center"
                  title="Close"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>

            {selectedUser.role === "admin" ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Shield className="size-8 mx-auto mb-2 text-muted-foreground/40" />
                Administrators have full access to all modules.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table text-sm">
                  <thead>
                    <tr>
                      <th className="min-w-[140px]">Module</th>
                      {FIELD_LABELS.map((f) => (
                        <th key={f.key} className="text-center min-w-[80px]">{f.label}</th>
                      ))}
                      <th className="text-center min-w-[100px]">Quick</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MODULES.map((mod) => {
                      const perm = selectedUser.permissions?.find((p) => p.moduleKey === mod.key);
                      const allAllowed = perm && FIELD_LABELS.every((f) => perm[f.key]);
                      const noneAllowed = !perm || FIELD_LABELS.every((f) => !perm[f.key]);
                      return (
                        <tr key={mod.key}>
                          <td className="font-medium">{mod.label}</td>
                          {FIELD_LABELS.map((f) => {
                            const allowed = perm ? perm[f.key] : false;
                            return (
                              <td key={f.key} className="text-center">
                                <button
                                  onClick={() => toggleAction(mod.key, f.key, !allowed)}
                                  className={`inline-flex items-center justify-center size-7 rounded border transition-colors ${
                                    allowed
                                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25"
                                      : "bg-muted/50 border-border text-muted-foreground/40 hover:bg-muted"
                                  }`}
                                  title={allowed ? `Deny ${f.label}` : `Allow ${f.label}`}
                                >
                                  {allowed ? <Check className="size-3.5" /> : <Square className="size-3.5" />}
                                </button>
                              </td>
                            );
                          })}
                          <td className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => bulkToggleModule(mod.key, true)}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                                  allAllowed
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                    : "bg-muted/50 text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600"
                                }`}
                                title="Allow all permissions for this module"
                              >
                                <CheckSquare className="size-3" />All
                              </button>
                              <button
                                onClick={() => bulkToggleModule(mod.key, false)}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                                  noneAllowed
                                    ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                                    : "bg-muted/50 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"
                                }`}
                                title="Deny all permissions for this module"
                              >
                                <Ban className="size-3" />None
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TableShell>
        )}

        {/* New/Edit user dialog */}
        <Dialog open={userOpen} onOpenChange={setUserOpen}>
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit User" : "New Manager"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Full Name *</Label>
                <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="h-8" placeholder="John Doe" />
              </div>
              <div>
                <Label className="text-xs">Username *</Label>
                <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="h-8" placeholder="johndoe" />
              </div>
              <div>
                <Label className="text-xs">Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-8" placeholder="john@example.com" />
              </div>
              <div>
                <Label className="text-xs">Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-8" placeholder="+91 90000 00000" />
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs">{editingId ? "New password (leave blank to keep)" : "Password *"}</Label>
                <div className="relative">
                  <Input type={showPw ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="h-8 pr-9" placeholder={editingId ? "••••••••" : "Min 4 characters"} />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                    {showPw ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setUserOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={saveUser}>{editingId ? "Update" : "Create"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Single permission toggle confirm */}
        <AlertDialog open={!!confirmTarget} onOpenChange={() => setConfirmTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm permission change</AlertDialogTitle>
              <AlertDialogDescription>
                {(() => {
                  const t = confirmTarget;
                  if (!t) return "";
                  const modLabel = MODULES.find((m) => m.key === t.moduleKey)?.label || t.moduleKey;
                  const actLabel = FIELD_LABELS.find((f) => f.key === t.field)?.label || t.field;
                  return t.grant
                    ? `Allow "${actLabel}" for "${modLabel}"?`
                    : `Deny "${actLabel}" for "${modLabel}"?`;
                })()}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { if (confirmTarget) { toggleAction(confirmTarget.moduleKey, confirmTarget.field, confirmTarget.grant); setConfirmTarget(null); } }}>
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk module toggle confirm */}
        <AlertDialog open={!!bulkConfirm} onOpenChange={() => setBulkConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{bulkConfirm?.grant ? "Allow all" : "Deny all"} permissions?</AlertDialogTitle>
              <AlertDialogDescription>
                {bulkConfirm && (() => {
                  const modLabel = MODULES.find((m) => m.key === bulkConfirm.moduleKey)?.label || bulkConfirm.moduleKey;
                  return bulkConfirm.grant
                    ? `Grant all 6 permissions (View, Create, Edit, Delete, Print, Export) for "${modLabel}"?`
                    : `Revoke all 6 permissions for "${modLabel}"?`;
                })()}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { if (bulkConfirm) { bulkToggleModule(bulkConfirm.moduleKey, bulkConfirm.grant); setBulkConfirm(null); } }}>
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* All modules toggle confirm */}
        <AlertDialog open={!!allConfirm} onOpenChange={() => setAllConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{allConfirm?.grant ? "Allow all" : "Deny all"} access?</AlertDialogTitle>
              <AlertDialogDescription>
                {allConfirm?.grant
                  ? "Grant all permissions for every module? This gives the user full access."
                  : "Revoke all permissions for every module? The user will have no access."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { if (allConfirm) { toggleAllModules(allConfirm.grant); setAllConfirm(null); } }}>
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete user confirm */}
        <AlertDialog open={deleteTarget != null} onOpenChange={() => setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete user?</AlertDialogTitle>
              <AlertDialogDescription>This action cannot be undone. The user will be permanently removed.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { if (deleteTarget != null) { removeUser(deleteTarget); setDeleteTarget(null); } }}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageContainer>
    </AppShell>
  );
}
