"use client";

import { createContext, useContext, useState } from "react";
import { Sidebar } from "./Sidebar";

const MobileMenuContext = createContext<{ open: () => void }>({ open: () => {} });
export const useMobileMenu = () => useContext(MobileMenuContext);

interface DashboardShellProps {
  role:     string;
  name?:    string | null;
  email?:   string | null;
  avatar?:  string | null;
  children: React.ReactNode;
}

export function DashboardShell({ role, name, email, avatar, children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <MobileMenuContext.Provider value={{ open: () => setMobileOpen(true) }}>
      <div className="flex h-screen overflow-hidden bg-surface-50">
        {/* Desktop sidebar */}
        <Sidebar role={role} name={name} email={email} avatar={avatar} />

        {/* Mobile drawer */}
        <Sidebar
          role={role}
          name={name}
          email={email}
          avatar={avatar}
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />

        {/* Main */}
        <main className="flex flex-1 flex-col overflow-hidden min-w-0">
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </main>
      </div>
    </MobileMenuContext.Provider>
  );
}
