'use client';

import { useState } from 'react';
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

  /** Where the last click asked to go, and where it was standing when it
   *  asked.
   *
   *  A page swap runs inside a transition, so `page` does not change until
   *  React has rendered the whole destination — a couple of hundred
   *  milliseconds during which the menu still highlights the screen you are
   *  leaving and the click reads as having missed. Recording the request
   *  here moves the highlight on the same frame as the press, and costs one
   *  render of the menu rather than one of the app.
   *
   *  `from` is what retires the guess: once `page` is anything other than
   *  the screen the request was made on, the request has either landed or
   *  been overtaken, and either way `page` is the better answer. */
  const [request, setRequest] = useState<{ target: PageName; from: PageName } | null>(null);
  const shown = request && request.from === page ? request.target : page;

  /** Below `lg` the nav is a drawer laid over the page, so picking a
   *  destination has to dismiss it — otherwise the page you asked for is
   *  hidden behind the menu you asked it from.
   *
   *  Dismissing it and swapping the page in the same breath is safe because
   *  the drawer is portalled outside the part of the tree the page swap
   *  captures: it keeps rendering live, and slides away over the new page
   *  rather than being frozen half-open in a snapshot of the old one. */
  function handleNavigate(target: PageName) {
    if (isMobile) setOpenMobile(false);
    setRequest({ target, from: page });
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
                const active = shown === target || (target === 'overview' && shown === 'itemDetail');
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
