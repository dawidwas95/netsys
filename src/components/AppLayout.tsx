import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { GlobalSearch } from "@/components/GlobalSearch";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { RedirectMobile } from "@/components/RedirectMobile";

export default function AppLayout() {
  return (
    <SidebarProvider>
      <RedirectMobile />
        <div className="min-h-screen flex w-full pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b bg-card px-4 gap-4 shrink-0 pt-[env(safe-area-inset-top)] md:pt-0 md:h-14" style={{ height: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}>
            <SidebarTrigger />
            <GlobalSearch />
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </main>
        </div>
        <MobileBottomNav />
      </div>
    </SidebarProvider>
  );
}
