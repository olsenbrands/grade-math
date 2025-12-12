'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  FolderOpen,
  Camera,
  BarChart3,
  Settings,
  Users,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TokenBalance } from '@/components/tokens';

interface DesktopSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const mainNavItems = [
  { href: '/dashboard', icon: Home, label: 'Dashboard' },
  { href: '/projects', icon: FolderOpen, label: 'Projects' },
  { href: '/scan', icon: Camera, label: 'Scan' },
  { href: '/results', icon: BarChart3, label: 'Results' },
  { href: '/students', icon: Users, label: 'Students' },
];

const bottomNavItems = [
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export function DesktopSidebar({ open, onOpenChange }: DesktopSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-4 z-50 md:hidden"
        onClick={() => onOpenChange(!open)}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Overlay for mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => onOpenChange(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 transform border-r bg-sidebar transition-transform duration-300',
          'md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center gap-2 border-b px-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-sm font-bold">GM</span>
            </div>
            <span className="text-lg font-semibold">Grade Math</span>
          </div>

          {/* Token balance */}
          <div className="border-b px-4 py-3">
            <TokenBalance showLabel={true} size="md" />
          </div>

          {/* Main navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            {mainNavItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => onOpenChange(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Bottom navigation */}
          <div className="border-t px-3 py-4">
            {bottomNavItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => onOpenChange(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* User menu */}
          <div className="border-t p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 px-3"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="" alt="User" />
                    <AvatarFallback>U</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start text-sm">
                    <span className="font-medium">Teacher Name</span>
                    <span className="text-xs text-muted-foreground">
                      View profile
                    </span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Account Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>
    </>
  );
}
