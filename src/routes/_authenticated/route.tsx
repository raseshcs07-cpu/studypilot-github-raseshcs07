import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  CalendarDays,
  Sparkles,
  Settings as SettingsIcon,
  LogOut,
  Moon,
  Sun,
  BookOpenCheck,
  Menu,
  X,
  CircleHelp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/subjects", label: "Subjects", icon: BookOpen },
  { to: "/exams", label: "Exams", icon: GraduationCap },
  { to: "/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/planner", label: "AI Planner", icon: Sparkles },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
  { to: "/help", label: "How to use", icon: CircleHelp },
] as const;

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [dark, setDark] = useState(() =>
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : false,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/auth", replace: true });
      else setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate({ to: "/auth", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("studypilot-theme", next ? "dark" : "light");
    } catch {
      // ignore
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const navLinks = (onClick?: () => void) =>
    NAV.map(({ to, label, icon: Icon }) => {
      const active = pathname.startsWith(to);
      return (
        <Link
          key={to}
          to={to}
          onClick={onClick}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            active
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      );
    });

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
        <Link to="/dashboard" className="flex items-center gap-2 font-bold text-foreground">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BookOpenCheck className="h-4 w-4" />
          </span>
          StudyPilot
        </Link>
        <div className="flex items-center gap-1">
          <button onClick={toggleTheme} className="btn-ghost px-2" aria-label="Toggle theme">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button onClick={() => setMenuOpen((v) => !v)} className="btn-ghost px-2" aria-label="Menu">
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>
      {menuOpen && (
        <nav className="space-y-1 border-b border-border bg-card p-3 lg:hidden">
          {navLinks(() => setMenuOpen(false))}
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </nav>
      )}

      <div className="mx-auto flex max-w-7xl">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card p-4 lg:flex">
          <Link to="/dashboard" className="mb-6 flex items-center gap-2 px-2 text-lg font-bold text-foreground">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <BookOpenCheck className="h-5 w-5" />
            </span>
            StudyPilot
          </Link>
          <nav className="flex-1 space-y-1">{navLinks()}</nav>
          <div className="space-y-1 border-t border-border pt-3">
            <button onClick={toggleTheme} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {dark ? "Light mode" : "Dark mode"}
            </button>
            <button onClick={signOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
