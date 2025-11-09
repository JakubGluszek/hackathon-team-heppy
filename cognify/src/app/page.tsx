import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/server/better-auth/server";
import { SignOutButton } from "@/app/_components/sign-out-button";
import { CreateGraphForm } from "@/app/_components/create-graph-form";
import { GraphsList } from "@/app/_components/graphs-list";

export default async function Home() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="from-background to-muted/20 min-h-screen bg-linear-to-b">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-12 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Cognify</h1>
            <p className="text-muted-foreground mt-2">
              AI-Powered Knowledge Graph Generator
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium">
                {session.user?.name ?? "User"}
              </p>
              <p className="text-muted-foreground text-xs">
                {session.user?.email}
              </p>
            </div>
            <SignOutButton />
          </div>
        </div>

        {/* Main Content */}
        <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row">
          {/* Create Form */}
          <div className="flex-1">
            <CreateGraphForm />
          </div>

          {/* Graphs List */}
          <div className="flex-1">
            <GraphsList />
          </div>
        </div>
      </div>
    </main>
  );
}
