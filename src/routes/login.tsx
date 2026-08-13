import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Eye, EyeOff, Shield, Warehouse } from "lucide-react";
import { APP_LOGO_URL } from "@/lib/brand";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Login — UDYANA" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please enter username and password");
      return;
    }
    setError("");
    setLoading(true);
    const result = await login(username.trim(), password);
    setLoading(false);
    if (!result.success) {
      setError(result.error || "Login failed");
    }
  };

  return (
    <div className="min-h-screen w-full flex">
      {/* ─── Left: Branding ─── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 items-center justify-center">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-40 size-96 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-40 -right-40 size-96 rounded-full bg-blue-500/5 blur-3xl" />
          <div className="absolute top-1/3 right-1/4 size-64 rounded-full bg-violet-500/5 blur-3xl" />
        </div>
        <div className="relative z-10 text-center px-12">
          <div className="size-24 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-6 ring-1 ring-white/20 shadow-2xl">
            <img src={APP_LOGO_URL} alt="UDYANA" className="size-14 object-contain" />
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">UDYANA</h1>
          <p className="text-lg text-white/60 mt-2 max-w-sm mx-auto leading-relaxed">
            uPVC Windows &amp; Doors ERP
          </p>
          <div className="mt-8 flex items-center justify-center gap-6 text-white/40 text-xs">
            
          </div>
        </div>
      </div>

      {/* ─── Right: Form ─── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-gradient-to-br from-background via-background to-muted/30">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="size-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mx-auto mb-4 ring-1 ring-primary/10">
              <img src={APP_LOGO_URL} alt="UDYANA" className="size-10 object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">UDYANA</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
          </div>

          {/* Desktop heading */}
          <div className="hidden lg:block mb-8">
            <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Username or Email
              </Label>
              <div className="relative">
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Email or username"
                  className="h-10 pl-3 bg-background border-border/60 focus-visible:ring-primary/30 transition-shadow"
                  autoFocus
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Password
                </Label>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-10 pl-3 pr-10 bg-background border-border/60 focus-visible:ring-primary/30 transition-shadow"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-2.5 text-sm text-destructive flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-destructive shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-10 text-sm font-semibold" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="size-4" />
                  Sign in
                </span>
              )}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-border/50 text-center">
            <p className="text-[11px] text-muted-foreground/60">
              UDYANA — uPVC Windows & Doors ERP
            </p>
              <p className="text-[10px] text-muted-foreground/40 mt-1">
                Data is securely stored on the server.
              </p>
          </div>
        </div>
      </div>
    </div>
  );
}
