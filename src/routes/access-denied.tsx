import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert, Home, LogIn } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/access-denied")({
  component: RouteComponent,
});

function RouteComponent() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <ShieldAlert className="mx-auto size-16 text-destructive/60 mb-4" />
        <h1 className="text-6xl font-bold text-foreground">403</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Access Denied</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You do not have permission to access this page. If you believe this is a mistake,
          please contact your administrator.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {isAuthenticated ? (
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Home className="size-4" />
              Go home
            </Link>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <LogIn className="size-4" />
              Sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
