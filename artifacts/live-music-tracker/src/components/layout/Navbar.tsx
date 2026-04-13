import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { Ticket, Users, Calendar, Settings, ShieldAlert, LogOut, Disc3, ChevronDown, Star } from "lucide-react";
import { motion } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useListFriendRequests } from "@workspace/api-client-react";
import { useState, useRef, useEffect } from "react";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Navbar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { data: requests } = useListFriendRequests();
  const pendingCount = requests?.length ?? 0;
  const [showsDropdownOpen, setShowsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  const isShowsActive = location === "/shows" || location === "/my-shows";

  const otherNavItems = [
    { href: "/calendar", label: "Calendar", icon: Calendar, badge: 0 },
    { href: "/friends", label: "Friends", icon: Users, badge: pendingCount },
    { href: "/profile", label: "Profile", icon: Settings, badge: 0 },
  ];

  if (user.isAdmin) {
    otherNavItems.push({ href: "/admin", label: "Admin", icon: ShieldAlert, badge: 0 });
  }

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-background/80 border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">

          <Link href="/shows" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-[0_0_15px_rgba(255,0,127,0.3)] group-hover:shadow-[0_0_25px_rgba(0,240,255,0.5)] transition-all duration-300">
              <Disc3 className="w-6 h-6 text-white group-hover:animate-spin" style={{ animationDuration: '3s' }} />
            </div>
            <span className="font-display text-2xl tracking-widest text-foreground hidden sm:block mt-1">
              TRACK <span className="text-primary">THE</span> NOISE
            </span>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2">

            {/* Shows dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowsDropdownOpen(o => !o)}
                className={cn(
                  "relative px-3 py-2 sm:px-4 sm:py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-colors duration-200",
                  isShowsActive ? "text-white" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                <Ticket className="w-4 h-4" />
                <span className="hidden md:block">Shows</span>
                <ChevronDown className={cn("w-3 h-3 transition-transform hidden md:block", showsDropdownOpen && "rotate-180")} />
                {isShowsActive && (
                  <motion.div
                    layoutId="navbar-active"
                    className="absolute inset-0 bg-white/10 rounded-lg border border-white/10"
                    initial={false}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>

              {showsDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-44 bg-card border border-border/50 rounded-xl shadow-xl overflow-hidden z-50">
                  <Link
                    href="/shows"
                    onClick={() => setShowsDropdownOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-colors",
                      location === "/shows"
                        ? "text-foreground bg-white/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    )}
                  >
                    <Ticket className="w-4 h-4 shrink-0" />
                    All Shows
                  </Link>
                  <div className="h-px bg-border/50 mx-3" />
                  <Link
                    href="/my-shows"
                    onClick={() => setShowsDropdownOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-colors",
                      location === "/my-shows"
                        ? "text-foreground bg-white/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    )}
                  >
                    <Star className="w-4 h-4 shrink-0" />
                    My Shows
                  </Link>
                </div>
              )}
            </div>

            {/* Other nav items */}
            {otherNavItems.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative px-3 py-2 sm:px-4 sm:py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-colors duration-200",
                    isActive ? "text-white" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  )}
                >
                  <span className="relative">
                    <Icon className="w-4 h-4" />
                    {item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none shadow-[0_0_8px_rgba(255,0,127,0.6)]">
                        {item.badge > 9 ? "9+" : item.badge}
                      </span>
                    )}
                  </span>
                  <span className="hidden md:block">{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="navbar-active"
                      className="absolute inset-0 bg-white/10 rounded-lg border border-white/10"
                      initial={false}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}

            <div className="w-px h-8 bg-border mx-2" />

            <button
              onClick={() => logout()}
              className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </nav>

        </div>
      </div>
    </header>
  );
}
