import { getSession } from "@/server/better-auth/server";

export default async function Home() {
  const session = await getSession();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <div className="container flex flex-col items-center justify-center gap-8 px-4 py-16">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Cognify
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          {session
            ? `Welcome back, ${session.user?.name ?? "User"}!`
            : "Get started by signing in"}
        </p>
      </div>
    </main>
  );
}
