import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@workspace/replit-auth-web";

import { Navbar } from "./components/layout/Navbar";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Shows } from "./pages/Shows";
import { MyShows } from "./pages/MyShows";
import { Friends } from "./pages/Friends";
import { Profile } from "./pages/Profile";
import { Admin } from "./pages/Admin";
import { CalendarPage } from "./pages/CalendarPage";
import NotFound from "@/pages/not-found";
import { Disc3 } from "lucide-react";

const queryClient = new QueryClient();

// Protected Route Wrapper
function ProtectedRoute({ component: Component, requireAdmin = false }: { component: any, requireAdmin?: boolean }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Disc3 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) return <Redirect to="/" />;
  if (requireAdmin && !user.isAdmin) return <Redirect to="/shows" />;

  return <Component />;
}

function AppRouter() {
  const { user } = useAuth();
  
  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      <div className="noise-overlay" />
      {user && <Navbar />}
      
      <main className="flex-1 relative z-10">
        <Switch>
          <Route path="/" component={Landing} />
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />
          <Route path="/shows">
            {() => <ProtectedRoute component={Shows} />}
          </Route>
          <Route path="/my-shows">
            {() => <ProtectedRoute component={MyShows} />}
          </Route>
          <Route path="/calendar">
            {() => <ProtectedRoute component={CalendarPage} />}
          </Route>
          <Route path="/friends">
            {() => <ProtectedRoute component={Friends} />}
          </Route>
          <Route path="/profile">
            {() => <ProtectedRoute component={Profile} />}
          </Route>
          <Route path="/admin">
            {() => <ProtectedRoute component={Admin} requireAdmin={true} />}
          </Route>
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppRouter />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
