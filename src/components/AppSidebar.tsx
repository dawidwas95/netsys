import {
  LayoutDashboard,
  Users,
  Monitor,
  Wrench,
  KanbanSquare,
  ListTodo,
  Settings,
  LogOut,
  Search,
  Package,
  ShoppingCart,
  FileText,
  Wallet,
  BookOpen,
  Receipt,
  ScrollText,
  Database,
  Download,
  Tv,
  CalendarDays,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";

const mainNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Klienci", url: "/clients", icon: Users },
  { title: "Urządzenia", url: "/devices", icon: Monitor },
  { title: "Magazyn", url: "/inventory", icon: Package },
  { title: "Niski stan", url: "/purchase-list", icon: ShoppingCart },
  { title: "Zapotrzebowanie", url: "/purchase-requests", icon: ShoppingCart },
];

const serviceNav = [
  { title: "Plan dnia", url: "/daily-plan", icon: CalendarDays },
  { title: "Tablica zleceń", url: "/orders/kanban", icon: KanbanSquare },
  { title: "Ekran serwisowy", url: "/service-board-display", icon: Tv },
  { title: "Lista zleceń", url: "/orders", icon: ListTodo },
  { title: "Prace IT", url: "/it-work", icon: Wrench },
  { title: "Oferty", url: "/offers", icon: FileText },
  { title: "Dokumentacja IT", url: "/it-docs", icon: BookOpen },
];

const financeNav = [
  { title: "Kasa gotówkowa", url: "/cash", icon: Wallet },
  { title: "Rejestr dokumentów", url: "/documents", icon: Receipt },
];

const systemNav = [
  { title: "Logi systemowe", url: "/system-logs", icon: ScrollText },
  { title: "Zarządzanie danymi", url: "/data-management", icon: Database },
  { title: "Ustawienia", url: "/settings", icon: Settings },
  { title: "Zainstaluj aplikację", url: "/install", icon: Download },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut } = useAuth();
  const { isAdmin, isSerwisant, canAccessFinance, canAccessSystemLogs, canAccessDataManagement, canAccessSettings, canAccessDocuments, canAccessOffers, canAccessITWork } = useUserRole();

  const isActive = (path: string) => location.pathname === path;

  const renderItems = (items: typeof mainNav) => (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild>
            <NavLink
              to={item.url}
              end={item.url === "/"}
              className="hover:bg-sidebar-accent/50"
              activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            >
              <item.icon className="mr-2 h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.title}</span>}
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );

  // Filter system nav based on role
  // Filter service nav for SERWISANT (no offers, no IT work module)
  const filteredServiceNav = serviceNav.filter((item) => {
    if (item.url === "/offers" && !canAccessOffers) return false;
    if (item.url === "/it-work" && !canAccessITWork) return false;
    return true;
  });

  const filteredSystemNav = systemNav.filter((item) => {
    if (item.url === "/system-logs" && !canAccessSystemLogs) return false;
    if (item.url === "/data-management" && !canAccessDataManagement) return false;
    if (item.url === "/settings" && !canAccessSettings) return false;
    return true;
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="px-4 py-4 flex items-center gap-2">
          <Wrench className="h-8 w-8 text-primary shrink-0" />
          {!collapsed && (
            <h1 className="text-lg font-bold text-sidebar-accent-foreground tracking-tight">
              Serwis
            </h1>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Nawigacja</SidebarGroupLabel>
          <SidebarGroupContent>{renderItems(mainNav)}</SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Serwis</SidebarGroupLabel>
          <SidebarGroupContent>{renderItems(filteredServiceNav)}</SidebarGroupContent>
        </SidebarGroup>

        {canAccessFinance && (
          <SidebarGroup>
            <SidebarGroupLabel>Finanse</SidebarGroupLabel>
            <SidebarGroupContent>{renderItems(financeNav)}</SidebarGroupContent>
          </SidebarGroup>
        )}

        {filteredSystemNav.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>System</SidebarGroupLabel>
            <SidebarGroupContent>{renderItems(filteredSystemNav)}</SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-2">
        {!collapsed && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
            onClick={() => signOut()}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Wyloguj się
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
