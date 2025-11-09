import "@/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { api, TRPCReactProvider } from "@/trpc/react";
import { Toaster } from "@/components/ui/sonner";

import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Separator } from '@/components/ui/separator';
import { getSession } from '@/server/better-auth/server';
import { redirect } from 'next/navigation';

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body>
        <TRPCReactProvider>
        <SidebarProvider>
        <AppSidebar user={session.user} />
          <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b">
          <div className="flex flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
          </div>
        </header>
        <div className="flex flex-1 flex-col overflow-hidden min-h-0">
          {children}
        </div>
          </SidebarInset>
          </SidebarProvider>
          </TRPCReactProvider>
        <Toaster />
      </body>
    </html>
  );
}
