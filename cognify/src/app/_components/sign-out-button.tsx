"use client";

import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";

export function SignOutButton() {
  const router = useRouter();
  const signOutMutation = api.auth.signOut.useMutation({
    onSuccess: () => {
      router.refresh();
      router.push("/");
    },
  });

  return (
    <button
      onClick={() => signOutMutation.mutate()}
      disabled={signOutMutation.isPending}
      className="rounded-lg bg-gray-900 px-6 py-3 font-medium text-white transition hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
    >
      {signOutMutation.isPending ? "Signing out..." : "Sign out"}
    </button>
  );
}

