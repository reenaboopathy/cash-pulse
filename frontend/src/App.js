import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Dashboard from "@/pages/Dashboard";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import { StoreProvider } from "@/hooks/useStore";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

function ProtectedAdmin({ children }) {
  const { admin, checking } = useAuth();
  if (checking) return <div className="p-8 text-muted-foreground">Checking session…</div>;
  if (!admin) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <StoreProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/login" element={<AdminLogin />} />
              <Route
                path="/admin"
                element={
                  <ProtectedAdmin>
                    <AdminDashboard />
                  </ProtectedAdmin>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster richColors position="top-right" />
        </StoreProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
