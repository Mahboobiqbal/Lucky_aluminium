import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Package,
  Ruler,
  FileText,
  ClipboardList,
  Boxes,
  Truck,
  Receipt,
  Wallet,
  TrendingDown,
  BarChart3,
  Settings,
  Database,
  Shield,
} from "lucide-react";
import { APP_LOGO_URL } from "@/lib/brand";
import { useAuth } from "@/lib/auth";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  moduleKey: string;
  adminOnly?: boolean;
};

const NAV: Array<{ section: string; items: NavItem[] }> = [
  { section: "Overview", items: [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, moduleKey: "dashboard" },
  ]},
  { section: "Sales", items: [
    { to: "/customers", label: "Customers", icon: Users, moduleKey: "customers" },
    { to: "/quotations", label: "Quotations", icon: FileText, moduleKey: "quotations" },
    { to: "/orders", label: "Orders", icon: ClipboardList, moduleKey: "orders" },
    { to: "/invoices", label: "Invoices", icon: Receipt, moduleKey: "invoices" },
    { to: "/payments", label: "Payments", icon: Wallet, moduleKey: "payments" },
  ]},
  { section: "Operations", items: [
    { to: "/products", label: "Products", icon: Package, moduleKey: "products" },
    { to: "/measurements", label: "Measurements", icon: Ruler, moduleKey: "measurements" },
    { to: "/stock-report", label: "Inventory", icon: Boxes, moduleKey: "inventory" },
    { to: "/suppliers", label: "Suppliers", icon: Truck, moduleKey: "suppliers" },
  ]},
  { section: "Finance", items: [
    { to: "/expenses", label: "Expenses", icon: TrendingDown, moduleKey: "expenses" },
    { to: "/reports", label: "Reports", icon: BarChart3, moduleKey: "reports" },
  ]},
  { section: "System", items: [
    { to: "/settings", label: "Settings", icon: Settings, moduleKey: "settings" },
    { to: "/access-control", label: "Access Control", icon: Shield, moduleKey: "settings", adminOnly: true },
    { to: "/backup", label: "Backup", icon: Database, moduleKey: "backup" },
  ]},
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { can, isAdmin } = useAuth();

  return (
    <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-56 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="h-12 flex items-center gap-2 px-4 border-b border-sidebar-border">
        <img
          src={APP_LOGO_URL}
          alt="Lucky Aluminium logo"
          className="size-8 rounded-md border border-sidebar-border bg-white object-contain p-0.5"
        />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">Lucky Aluminium</span>
          <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">Aluminium</span>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV.map((group) => {
          const visibleItems = group.items.filter((item) => {
            if (item.adminOnly && !isAdmin) return false;
            return can(item.moduleKey, "view");
          });
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.section} className="mb-2">
              <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                {group.section}
              </div>
              {visibleItems.map((item) => {
                const active = item.to === "/" ? pathname === "/" : pathname === item.to || pathname.startsWith(item.to + "/");
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-2.5 px-4 py-1.5 text-[13px] transition-colors border-l-2 ${
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-primary font-medium"
                        : "border-transparent text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                    }`}
                  >
                    <item.icon className="size-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
