import Link from "next/link";

import { getSession } from "@/server/better-auth/server";
import { SignOutButton } from "@/app/_components/sign-out-button";

export default async function Home() {
  const session = await getSession();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <div className="container flex flex-col items-center justify-center gap-8 px-4 py-16">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Cognify
        </h1>
        {session ? (
          <>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Welcome back, {session.user?.name ?? "User"}!
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Email: {session.user?.email}
            </p>
            <SignOutButton />
          </>
        ) : (
          <>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Get started by signing in
            </p>
            <Link
              href="/login"
              className="rounded-lg bg-gray-900 px-6 py-3 font-medium text-white transition hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
            >
              Go to Login
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
