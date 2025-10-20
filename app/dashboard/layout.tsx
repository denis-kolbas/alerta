'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart, Home, LogOut, Users, Settings, Activity, Plug } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { signOut } from '@/app/(login)/actions';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const navItems = [
  { href: '/dashboard', icon: Home, label: 'Overview' },
  { href: '/dashboard/alerts', icon: BarChart, label: 'Alerts' },
  { href: '/dashboard/alerts-2', icon: BarChart, label: 'Alerts 2' },
  { href: '/dashboard/integrations', icon: Plug, label: 'Integrations' },
  { href: '/dashboard/team', icon: Users, label: 'Team' },
  { href: '/dashboard/account', icon: Settings, label: 'Account' },
  { href: '/dashboard/activity', icon: Activity, label: 'Activity' },
];

function AppSidebar() {
  const pathname = usePathname();
  const { data: user } = useSWR('/api/user', fetcher);

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-4 py-2">
          <span className="font-semibold text-lg">Alerta</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {user && (
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton>
                    <Avatar className="h-6 w-6">
                      <AvatarFallback>
                        {user.email?.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{user.email}</span>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.name || 'User'}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <form action={signOut}>
                      <button type="submit" className="w-full text-left flex items-center">
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign out
                      </button>
                    </form>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1">
          <div className="border-b">
            <div className="flex h-16 items-center px-6">
              <SidebarTrigger />
            </div>
          </div>
          <div className="flex-1">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}