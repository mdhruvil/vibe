"use client";

import { LogInIcon } from "lucide-react";
import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { useSession } from "@/lib/auth-client";
import { AppSidebarContent } from "./app-sidebar-content";
import { Logo } from "./logo";
import { NavUser } from "./sidebar-user";
import { buttonVariants } from "./ui/button";

export function AppSidebar() {
  const { data, isPending } = useSession();

  function renderFooterContent() {
    if (isPending) {
      return (
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuSkeleton />
          </SidebarMenuItem>
        </SidebarMenu>
      );
    }
    if (!data?.user) {
      return (
        <SidebarMenu>
          <SidebarMenuButton asChild>
            <Link
              className={buttonVariants({
                size: "lg",
                variant: "outline",
              })}
              href="/auth"
            >
              <LogInIcon className="size-5" />
              Login
            </Link>
          </SidebarMenuButton>
        </SidebarMenu>
      );
    }

    return (
      <NavUser
        user={{
          avatar:
            data.user.image ??
            `https://api.dicebear.com/9.x/notionists/svg?seed=${data.user.email}&scale=150&backgroundType=solid,gradientLinear&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`,
          email: data.user.email,
          name: data.user.name,
        }}
      />
    );
  }
  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <Link href="/">
                <div>
                  <Logo className="size-6" />
                </div>
                <p className="grid flex-1 text-left font-bold text-lg">Vibe</p>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <AppSidebarContent />
      </SidebarContent>
      <SidebarFooter>{renderFooterContent()}</SidebarFooter>
    </Sidebar>
  );
}
