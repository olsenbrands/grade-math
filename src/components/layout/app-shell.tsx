'use client';

import { useState } from 'react';
import { MobileNav } from './mobile-nav';
import { DesktopSidebar } from './desktop-sidebar';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar - hidden on mobile */}
      <DesktopSidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
      />

      {/* Main content area */}
      <main
        className={cn(
          'min-h-screen transition-all duration-300',
          'pb-16 md:pb-0', // Bottom padding for mobile nav
          'md:pl-64' // Left padding for desktop sidebar
        )}
      >
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>

      {/* Mobile bottom navigation - hidden on desktop */}
      <MobileNav />
    </div>
  );
}
