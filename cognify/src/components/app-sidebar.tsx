"use client"

import * as React from "react"
import Link from "next/link"
import { Brain } from "lucide-react"
import { NavFavorites } from "@/components/nav-favorites"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { api } from '@/trpc/react';
import { UserMenu } from "@/app/_components/user-menu";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  const { data: graphs, isLoading } = api.graphs.list.useQuery();
  
  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader>
        <Link href="/" className="flex items-center gap-2 px-2 py-3 font-semibold">
          <Brain className="h-5 w-5" />
          <span>Cognify</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <NavFavorites graphs={graphs ?? []} isLoading={isLoading} />
      </SidebarContent>
      {user && (
        <SidebarFooter>
          <UserMenu user={user} />
        </SidebarFooter>
      )}
      <SidebarRail />
    </Sidebar>
  )
}
