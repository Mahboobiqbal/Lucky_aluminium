import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth";
import { Plus, Trash2, Eye, EyeOff, Save, Building2, Banknote, UserCog, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — UDYANA" }] }),
  component: SettingsPage,
});

const TEXT_KEYS = [
  { key: "companyName", label: "Company name" },
  { key: "address", label: "Address" },
  { key: "email", label: "Email" },
  { key: "currency", label: "Currency symbol" },
  { key: "invoicePrefix", label: "Invoice prefix" },
];

const BANK_KEYS = [
  { key: "bankName", label: "Bank Name" },
  { key: "accountTitle", label: "Account Title" },
  { key: "accountNumber", label: "Account Number" },
  { key: "iban", label: "IBAN (Optional)" },
  { key: "branchName", label: "Branch Name (Optional)" },
];

type Tab = "company" | "bank" | "account";

function SettingsPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { currentUser, updatePassword } = useAuth();
  const [values, setValues] = useState<Record<string, string>>({});
  const [phones, setPhones] = useState<Array<{ label: string; number: string }>>([{ label: "", number: "" }]);
  const [tab, setTab] = useState<Tab>("company");
  const [showPassword, setShowPassword] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await api.safeGet<Array<{ key: string; value: string }>>("/api/settings");
      if (!data) return;
      const map: Record<string, string> = {};
      data.forEach((s) => { map[s.key] = s.value; });
      setValues(map);
      try {
        const parsed = JSON.parse(map.phone || "[]");
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object" && parsed[0] !== null && "label" in parsed[0]) {
          setPhones(parsed);
        } else if (Array.isArray(parsed) && parsed.length > 0) {
          setPhones(parsed.map((p: string) => ({ label: "", number: p })));
        } else {
          setPhones([{ label: "", number: map.phone || "" }]);
        }
      } catch { setPhones([{ label: "", number: map.phone || "" }]); }
    } catch {}
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  if (pathname.startsWith("/settings/")) return <Outlet />;

  const updatePhone = (index: number, field: "label" | "number", value: string) => {
    setPhones((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };
  const addPhone = () => setPhones((prev) => [...prev, { label: "", number: "" }]);
  const removePhone = (index: number) => setPhones((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const saveSettings = async () => {
    try {
      const filteredPhones = phones.map((p) => ({ label: p.label.trim(), number: p.number.trim() })).filter((p) => p.number);
      const allValues = { ...values, phone: JSON.stringify(filteredPhones) };
      const body = Object.entries(allValues).map(([key, value]) => ({ key, value }));
      await api.put("/api/settings", body);
      toast.success("Settings saved");
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const handleChangePassword = async () => {
    if (!currentPw) return toast.error("Enter current password");
    if (!newPw) return toast.error("Enter new password");
    if (newPw.length < 4) return toast.error("Min 4 characters");
    if (newPw !== confirmPw) return toast.error("Passwords do not match");
    const result = await updatePassword(currentUser!.id, currentPw, newPw);
    if (result.success) { toast.success("Password changed"); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }
    else toast.error(result.error || "Failed");
  };

  const handleResetAllData = async () => {
    setResetting(true);
    try {
      await api.post("/api/settings/reset");
      if (typeof window !== "undefined") {
        window.localStorage.clear();
        window.sessionStorage.clear();
      }
      toast.success("All data reset. Refreshing...");
      window.location.reload();
    } catch (err: any) {
      setResetting(false);
      setResetOpen(false);
      toast.error(err.message || "Reset failed");
    }
  };

  const tabs: { key: Tab; label: string; icon: typeof Building2 }[] = [
    { key: "company", label: "Company Profile", icon: Building2 },
    { key: "bank", label: "Bank Details", icon: Banknote },
    { key: "account", label: "Account", icon: UserCog },
  ];

  return (
    <AppShell title="Settings">
      <PageContainer>
        <div className="max-w-2xl space-y-4">
          <div className="flex gap-1 p-1 rounded-lg bg-muted/60 border border-border w-fit">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === t.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                <t.icon className="size-3.5" />{t.label}
              </button>
            ))}
          </div>

          {tab === "company" && (
            <div className="bg-card border border-border rounded-md">
              <div className="px-4 py-2.5 border-b border-border text-sm font-semibold flex items-center gap-2"><Building2 className="size-4 text-primary" />Company Profile</div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TEXT_KEYS.map((k) => (
                  <div key={k.key} className={k.key === "address" ? "col-span-2" : ""}>
                    <Label className="text-xs">{k.label}</Label><Input value={values[k.key] || ""} onChange={(e) => setValues({ ...values, [k.key]: e.target.value })} className="h-8" />
                  </div>
                ))}
                <div className="col-span-2">
                  <Label className="text-xs">Phone Numbers</Label>
                  <div className="space-y-1.5 mt-1">
                    {phones.map((phone, i) => (
                      <div key={i} className="flex gap-1.5 items-center">
                        <Input value={phone.label} onChange={(e) => updatePhone(i, "label", e.target.value)} placeholder="e.g. Sales, Office" className="h-8 w-28 shrink-0" />
                        <Input value={phone.number} onChange={(e) => updatePhone(i, "number", e.target.value)} placeholder={i === 0 ? "Primary contact" : `Number ${i + 1}`} className="h-8 flex-1" />
                        <button type="button" onClick={() => removePhone(i)} className="size-7 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive inline-grid place-items-center shrink-0"><Trash2 className="size-3.5" /></button>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="mt-1.5 h-7 text-xs" onClick={addPhone}><Plus className="size-3 mr-1" />Add phone</Button>
                </div>
              </div>
              <div className="px-4 py-3 border-t border-border flex justify-end"><Button size="sm" onClick={saveSettings}><Save className="size-3.5 mr-1" />Save</Button></div>
            </div>
          )}

          {tab === "bank" && (
            <div className="bg-card border border-border rounded-md">
              <div className="px-4 py-2.5 border-b border-border text-sm font-semibold flex items-center gap-2"><Banknote className="size-4 text-primary" />Bank Details</div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {BANK_KEYS.map((k) => (
                  <div key={k.key} className={k.key === "iban" || k.key === "branchName" ? "col-span-1" : "col-span-2"}>
                    <Label className="text-xs">{k.label}</Label><Input value={values[k.key] || ""} onChange={(e) => setValues({ ...values, [k.key]: e.target.value })} className="h-8" placeholder={k.label} />
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-border flex justify-end"><Button size="sm" onClick={saveSettings}><Save className="size-3.5 mr-1" />Save</Button></div>
            </div>
          )}

          {tab === "account" && (
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-md">
                <div className="px-4 py-2.5 border-b border-border text-sm font-semibold flex items-center gap-2"><UserCog className="size-4 text-primary" />Account</div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label className="text-xs">Username</Label><div className="h-8 px-2 rounded border bg-muted/30 flex items-center text-sm font-medium">{currentUser?.username || "—"}</div></div>
                    <div><Label className="text-xs">Role</Label><div className="h-8 px-2 rounded border bg-muted/30 flex items-center text-sm font-medium"><span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium border bg-violet-500/15 text-violet-600 border-violet-500/30">{currentUser?.role === "admin" ? "Admin" : "Manager"}</span></div></div>
                  </div>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-2 mb-2"><ShieldAlert className="size-4 text-muted-foreground" /><span className="text-sm font-semibold">Change Password</span></div>
                    <div className="space-y-3">
                      <div><Label className="text-xs">Current password</Label><Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className="h-8" /></div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div><Label className="text-xs">New password</Label><Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="h-8" /></div>
                        <div><Label className="text-xs">Confirm</Label><Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className="h-8" /></div>
                      </div>
                      <div className="flex justify-end"><Button size="sm" onClick={handleChangePassword}><Save className="size-3.5 mr-1" />Change password</Button></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="border border-destructive/25 bg-destructive/5 rounded-md overflow-hidden">
            <div className="px-4 py-2.5 border-b border-destructive/20 bg-destructive/10 text-sm font-semibold flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-4" />Danger Zone
            </div>
            <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Reset all data</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Permanently deletes all business records — suppliers, customers, products, purchases,
                  invoices, payments, inventory, and backups. Your account and its permissions are kept.
                  This action cannot be undone.
                </p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setResetOpen(true)} disabled={resetting} className="shrink-0 gap-1.5">
                <ShieldAlert className="size-3.5" />{resetting ? "Resetting..." : "Reset all data"}
              </Button>
            </div>
          </div>
        </div>
      </PageContainer>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all saved data?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete all business data in the application, including suppliers, customers, products, purchases, invoices, payments, inventory, and backups. The app files and source code will remain intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetAllData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Reset everything</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
