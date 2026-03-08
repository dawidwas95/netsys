import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import AuthPage from "@/pages/AuthPage";
import DashboardPage from "@/pages/DashboardPage";
import ClientsPage from "@/pages/ClientsPage";
import ClientDetailPage from "@/pages/ClientDetailPage";
import DevicesPage from "@/pages/DevicesPage";
import ServiceOrdersPage from "@/pages/ServiceOrdersPage";
import KanbanPage from "@/pages/KanbanPage";
import OrderDetailPage from "@/pages/OrderDetailPage";
import ITWorkPage from "@/pages/ITWorkPage";
import MyOrdersPage from "@/pages/MyOrdersPage";
import MobileHomePage from "@/pages/MobileHomePage";
import InventoryPage from "@/pages/InventoryPage";
import PurchaseListPage from "@/pages/PurchaseListPage";
import PurchaseRequestsPage from "@/pages/PurchaseRequestsPage";
import InstallPage from "@/pages/InstallPage";
import OffersPage from "@/pages/OffersPage";
import CashRegisterPage from "@/pages/CashRegisterPage";
import ITDocsPage from "@/pages/ITDocsPage";
import DocumentsPage from "@/pages/DocumentsPage";
import SystemLogsPage from "@/pages/SystemLogsPage";
import DataManagementPage from "@/pages/DataManagementPage";
import SettingsPage from "@/pages/SettingsPage";
import WarehouseDocumentsPage from "@/pages/WarehouseDocumentsPage";
import OrderStatusPage from "@/pages/OrderStatusPage";
import ServiceBoardDisplay from "@/pages/ServiceBoardDisplay";
import DailyPlanPage from "@/pages/DailyPlanPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Ładowanie...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AppLayout />
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPageWrapper />} />
          <Route path="/status" element={<OrderStatusPage />} />
          <Route path="/service-board-display" element={<ServiceBoardDisplay />} />
          <Route element={<ProtectedRoutes />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/mobile" element={<MobileHomePage />} />
            <Route path="/my-orders" element={<MyOrdersPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/clients/:id" element={<ClientDetailPage />} />
            <Route path="/devices" element={<DevicesPage />} />
            <Route path="/orders" element={<ServiceOrdersPage />} />
            <Route path="/daily-plan" element={<DailyPlanPage />} />
            <Route path="/orders/kanban" element={<KanbanPage />} />
            <Route path="/orders/:id" element={<OrderDetailPage />} />
            {/* Hidden modules (can be restored later): */}
            {/* <Route path="/it-work" element={<ITWorkPage />} /> */}
            {/* <Route path="/offers" element={<OffersPage />} /> */}
            {/* <Route path="/it-docs" element={<ITDocsPage />} /> */}
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/warehouse-documents" element={<WarehouseDocumentsPage />} />
            <Route path="/purchase-list" element={<PurchaseListPage />} />
            <Route path="/purchase-requests" element={<PurchaseRequestsPage />} />
            <Route path="/cash" element={<CashRegisterPage />} />
            <Route path="/it-docs" element={<ITDocsPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/system-logs" element={<SystemLogsPage />} />
            <Route path="/data-management" element={<DataManagementPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/install" element={<InstallPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

function AuthPageWrapper() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <AuthPage />;
}

export default App;
