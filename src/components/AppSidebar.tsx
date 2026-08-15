'use client';

import { Folder, LayoutDashboard, ListChecks } from 'lucide-react';
import type { PageName } from '@/types';
import BrandLogo from './BrandLogo';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

interface AppSidebarProps {
  page: PageName;
  attention: number;
  onNavigate: (page: PageName) => void;
}

const NAV = [
  { page: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
  { page: 'overview'  as const, label: 'Overview',  icon: ListChecks },
  { page: 'projects'  as const, label: 'Projects',  icon: Folder },
];

export default function AppSidebar({ page, attention, onNavigate }: AppSidebarProps) {
  const { isMobile, setOpenMobile } = useSidebar();

  /** Below `lg` the nav is a sheet laid over the page, so picking a
   *  destination has to dismiss it — otherwise the page you asked for is
   *  hidden behind the menu you asked it from. */
  function handleNavigate(target: PageName) {
    if (isMobile) setOpenMobile(false);
    onNavigate(target);
  }

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="px-1 py-3">
        <BrandLogo />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map(({ page: target, label, icon: Icon }) => {
                const active = page === target || (target === 'overview' && page === 'itemDetail');
                return (
                  <SidebarMenuItem key={target}>
                    <SidebarMenuButton isActive={active} onClick={() => handleNavigate(target)}>
                      <Icon className="size-4 shrink-0" />
                      <span>{label}</span>
                    </SidebarMenuButton>
                    {target === 'overview' && attention > 0 && (
                      <SidebarMenuBadge className="bg-late-bg text-late-fg">
                        {attention}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
