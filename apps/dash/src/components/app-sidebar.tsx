"use client";

import {
  Calendar,
  Home,
  Inbox,
  LogInIcon,
  PlusIcon,
  Search,
  Settings,
} from "lucide-react";
import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useSession } from "@/lib/auth-client";
import { Logo } from "./logo";
import { NavUser } from "./sidebar-user";
import { buttonVariants } from "./ui/button";

// Menu items.
const items = [
  {
    title: "Home",
    url: "#",
    icon: Home,
  },
  {
    title: "Inbox",
    url: "#",
    icon: Inbox,
  },
  {
    title: "Calendar",
    url: "#",
    icon: Calendar,
  },
  {
    title: "Search",
    url: "#",
    icon: Search,
  },
  {
    title: "Settings",
    url: "#",
    icon: Settings,
  },
];

export function AppSidebar() {
  const { data } = useSession();
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
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuButton asChild>
                <Link
                  className={buttonVariants({
                    size: "lg",
                    variant: "outline",
                  })}
                  href="/"
                >
                  <PlusIcon className="size-5" />
                  New Chat
                </Link>
              </SidebarMenuButton>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Chats</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {data?.user ? (
          <NavUser
            user={{
              avatar: data.user.image ?? "",
              email: data.user.email,
              name: data.user.name,
            }}
          />
        ) : (
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
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
