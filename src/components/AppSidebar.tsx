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
  FileText,
  Wallet,
  BookOpen,
  Receipt,
  ScrollText,
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
import { Button } from "@/components/ui/button";

const mainNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Klienci", url: "/clients", icon: Users },
  { title: "Urządzenia", url: "/devices", icon: Monitor },
  { title: "Magazyn", url: "/inventory", icon: Package },
];

const serviceNav = [
  { title: "Tablica zleceń", url: "/orders/kanban", icon: KanbanSquare },
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
  { title: "Ustawienia", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut } = useAuth();

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

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="px-4 py-4">
          {!collapsed ? (
            <h1 className="text-lg font-bold text-sidebar-accent-foreground tracking-tight">
              🔧 Serwis<span className="text-sidebar-primary">Pro</span>
            </h1>
          ) : (
            <span className="text-lg">🔧</span>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Nawigacja</SidebarGroupLabel>
          <SidebarGroupContent>{renderItems(mainNav)}</SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Serwis</SidebarGroupLabel>
          <SidebarGroupContent>{renderItems(serviceNav)}</SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Finanse</SidebarGroupLabel>
          <SidebarGroupContent>{renderItems(financeNav)}</SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>{renderItems(systemNav)}</SidebarGroupContent>
        </SidebarGroup>
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
