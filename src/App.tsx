import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { ProtectedRoute } from "./components/admin/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Packages from "./pages/Packages";
import Customers from "./pages/Customers";
import CustomerView from "./pages/CustomerView";
import CustomerEdit from "./pages/CustomerEdit";
import Orders from "./pages/Orders";
import OrderCreate from "./pages/OrderCreate";
import OrderView from "./pages/OrderView";
import OrderEdit from "./pages/OrderEdit";
import Payments from "./pages/Payments";
import Birthdays from "./pages/Birthdays";
import Delinquency from "./pages/Delinquency";
import OrganizationSettings from "./pages/OrganizationSettings";
import CreateOrganization from "./pages/CreateOrganization";
import AcceptInvite from "./pages/AcceptInvite";
import UsersManagement from "./pages/admin/UsersManagement";
import OrganizationsManagement from "./pages/admin/OrganizationsManagement";
import OrganizationDetails from "./pages/admin/OrganizationDetails";
import UserEdit from "./pages/admin/UserEdit";
import Profile from "./pages/Profile";
import WaitingApproval from "./pages/WaitingApproval";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/dashboard" element={<MainLayout><Dashboard /></MainLayout>} />
          <Route path="/packages" element={<MainLayout><Packages /></MainLayout>} />
          <Route path="/customers" element={<MainLayout><Customers /></MainLayout>} />
          <Route path="/customers/:id" element={<MainLayout><CustomerView /></MainLayout>} />
          <Route path="/customers/:id/edit" element={<MainLayout><CustomerEdit /></MainLayout>} />
          <Route path="/orders" element={<MainLayout><Orders /></MainLayout>} />
          <Route path="/orders/create" element={<MainLayout><OrderCreate /></MainLayout>} />
          <Route path="/orders/:id" element={<MainLayout><OrderView /></MainLayout>} />
          <Route path="/orders/:id/edit" element={<MainLayout><OrderEdit /></MainLayout>} />
          <Route path="/payments" element={<MainLayout><Payments /></MainLayout>} />
          <Route path="/birthdays" element={<MainLayout><Birthdays /></MainLayout>} />
          <Route path="/delinquency" element={<MainLayout><Delinquency /></MainLayout>} />
          <Route path="/organization/settings" element={<MainLayout><OrganizationSettings /></MainLayout>} />
        <Route 
          path="/organization/create" 
          element={
            <ProtectedRoute>
              <CreateOrganization />
            </ProtectedRoute>
          } 
        />
          <Route path="/invite/:token" element={<AcceptInvite />} />
          <Route path="/profile" element={<MainLayout><Profile /></MainLayout>} />
          <Route path="/waiting-approval" element={<WaitingApproval />} />
          <Route path="/admin/users" element={<MainLayout><ProtectedRoute><UsersManagement /></ProtectedRoute></MainLayout>} />
          <Route path="/admin/users/:id/edit" element={<MainLayout><ProtectedRoute><UserEdit /></ProtectedRoute></MainLayout>} />
          <Route path="/admin/organizations" element={<MainLayout><ProtectedRoute><OrganizationsManagement /></ProtectedRoute></MainLayout>} />
          <Route path="/admin/organizations/:id" element={<MainLayout><ProtectedRoute><OrganizationDetails /></ProtectedRoute></MainLayout>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
