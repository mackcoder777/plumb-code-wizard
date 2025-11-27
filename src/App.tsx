import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { Auth } from "./components/Auth";
import { AdminCostCodeUpload } from "./components/AdminCostCodeUpload";
import { useAuth } from "./hooks/useAuth";
import { Loader2, LogOut, Shield } from "lucide-react";
import { Button } from "./components/ui/button";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Shield className="h-16 w-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">You don't have admin permissions.</p>
          <Button onClick={() => window.location.href = '/'}>Go to Home</Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const AppContent = () => {
  const { user, signOut, isAdmin } = useAuth();

  return (
    <div className="min-h-screen">
      {user && (
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold">Plumbing Estimate Manager</h1>
              {isAdmin && (
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">Admin</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.href = '/admin'}
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Admin Panel
                </Button>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="hidden sm:inline">{user.email}</span>
                <Button variant="ghost" size="sm" onClick={signOut}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </header>
      )}
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Index />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <div className="container mx-auto p-6 max-w-5xl">
                <AdminCostCodeUpload />
              </div>
            </AdminRoute>
          }
        />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
