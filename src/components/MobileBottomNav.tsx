import { useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard, ListTodo, Package, ClipboardList, Menu, CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Users, Monitor, Wrench, KanbanSquare, FileText, Wallet,
  Receipt, ScrollText, Database, Settings, BookOpen, LogOut, Download, Tv,
} from "lucide-react";

const bottomTabs = [
  { label: "Start", icon: LayoutDashboard, href: "/" },
  { label: "Moje", icon: ClipboardList, href: "/my-orders" },
  { label: "Zlecenia", icon: ListTodo, href: "/orders" },
  { label: "Magazyn", icon: Package, href: "/inventory" },
  { label: "Więcej", icon: Menu, href: "__menu__" },
];

const menuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Klienci", url: "/clients", icon: Users },
  { title: "Urządzenia", url: "/devices", icon: Monitor },
  { title: "Tablica zleceń", url: "/orders/kanban", icon: KanbanSquare },
  { title: "Ekran serwisowy", url: "/service-board-display", icon: Tv },
  { title: "Prace IT", url: "/it-work", icon: Wrench },
  { title: "Oferty", url: "/offers", icon: FileText },
  { title: "Dokumentacja IT", url: "/it-docs", icon: BookOpen },
  { title: "Kasa gotówkowa", url: "/cash", icon: Wallet },
  { title: "Rejestr dokumentów", url: "/documents", icon: Receipt },
  { title: "Logi systemowe", url: "/system-logs", icon: ScrollText },
  { title: "Zarządzanie danymi", url: "/data-management", icon: Database },
  { title: "Ustawienia", url: "/settings", icon: Settings },
  { title: "Zainstaluj aplikację", url: "/install", icon: Download },
];

export function MobileBottomNav() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { signOut } = useAuth();
  const { canAccessFinance, canAccessSystemLogs, canAccessDataManagement, canAccessSettings, canAccessDocuments, canAccessOffers, canAccessITWork } = useUserRole();

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  };

  const filteredMenu = menuItems.filter((item) => {
    if (item.url === "/cash") return canAccessFinance;
    if (item.url === "/documents") return canAccessDocuments;
    if (item.url === "/offers") return canAccessOffers;
    if (item.url === "/it-work") return canAccessITWork;
    if (item.url === "/system-logs") return canAccessSystemLogs;
    if (item.url === "/data-management") return canAccessDataManagement;
    if (item.url === "/settings") return canAccessSettings;
    return true;
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-stretch">
        {bottomTabs.map((tab) => {
          if (tab.href === "__menu__") {
            return (
              <Sheet key="menu" open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild>
                  <button className="flex-1 flex flex-col items-center justify-center py-2 min-h-[56px] text-muted-foreground">
                    <tab.icon className="h-5 w-5" />
                    <span className="text-[10px] mt-0.5">{tab.label}</span>
                  </button>
                </SheetTrigger>
                <SheetContent side="bottom" className="max-h-[70vh] rounded-t-2xl">
                  <SheetHeader>
                    <SheetTitle>Menu</SheetTitle>
                  </SheetHeader>
                  <div className="grid grid-cols-3 gap-3 py-4">
                    {filteredMenu.map((item) => (
                      <Link
                        key={item.url}
                        to={item.url}
                        onClick={() => setMenuOpen(false)}
                        className={cn(
                          "flex flex-col items-center gap-1.5 p-3 rounded-xl min-h-[72px] justify-center active:scale-95 transition-transform",
                          isActive(item.url) ? "bg-primary/10 text-primary" : "bg-muted/50 text-foreground"
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                        <span className="text-xs text-center leading-tight">{item.title}</span>
                      </Link>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-destructive min-h-[44px]"
                    onClick={() => signOut()}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Wyloguj się
                  </Button>
                </SheetContent>
              </Sheet>
            );
          }

          return (
            <Link
              key={tab.href}
              to={tab.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-2 min-h-[56px] transition-colors",
                isActive(tab.href) ? "text-primary" : "text-muted-foreground"
              )}
            >
              <tab.icon className="h-5 w-5" />
              <span className="text-[10px] mt-0.5 font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
