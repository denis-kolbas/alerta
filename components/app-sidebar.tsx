'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart, Home, Users, Settings, Activity, Plug } from 'lucide-react';
import { NavUser } from '@/components/nav-user';
import { TeamSwitcher } from '@/components/team-switcher';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import useSWR from 'swr';
import { useAlertCount } from '@/lib/contexts/alert-context';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const navItems = [
  { href: '/dashboard', icon: Home, label: 'Overview' },
  { href: '/dashboard/alerts', icon: BarChart, label: 'Alerts' },
  { href: '/dashboard/alerts-2', icon: BarChart, label: 'Alerts 2' },
  { href: '/dashboard/integrations', icon: Plug, label: 'Integrations' },
  { href: '/dashboard/team', icon: Users, label: 'Organization' },
  { href: '/dashboard/account', icon: Settings, label: 'Account' },
  { href: '/dashboard/activity', icon: Activity, label: 'Activity' },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { data: user } = useSWR('/api/user', fetcher);
  const { data: teamsData } = useSWR('/api/team/list', fetcher);
  const { activeAlertCount } = useAlertCount();

  const teams = teamsData?.teams || [];
  const currentTeamId = teamsData?.currentTeamId || null;
  const organizationRole = teamsData?.organizationRole || null;

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher 
          teams={teams} 
          currentTeamId={currentTeamId}
          organizationRole={organizationRole}
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isAlertPage = item.href === '/dashboard/alerts' || item.href === '/dashboard/alerts-2';
                const showCount = isAlertPage && activeAlertCount > 0;
                
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={pathname === item.href}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                        {showCount && (
                          <span className="ml-auto rounded-full bg-red-200 px-2 py-0.5 text-xs font-semibold text-red-800">
                            {activeAlertCount}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {user && (
          <NavUser
            user={{
              name: user.name || 'User',
              email: user.email,
              avatar: '',
            }}
          />
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
