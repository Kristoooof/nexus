import React, { useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { Search, Compass, Lightbulb, User, Menu, X, Home } from "lucide-react";

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { to: "/", icon: Home, label: "Kezdőlap" },
    { to: "/discover", icon: Compass, label: "Felfedezés" },
    { to: "/recommendations", icon: Lightbulb, label: "Ajánlás" },
    { to: "/profile", icon: User, label: "Profil" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Topbar */}
      <header className="sticky top-0 z-50 glass border-b border-border/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="text-2xl font-display font-bold gradient-text">
              NEXUS
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all duration-200"
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-secondary/50 text-foreground"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden glass border-t border-border/30 px-4 py-3">
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main>
        <Outlet />
      </main>
    </div>
  );
}