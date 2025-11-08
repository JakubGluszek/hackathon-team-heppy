"use client";

import { authClient } from "@/server/better-auth/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    authClient.getSession().then((session) => {
      if (session?.data?.session) {
        router.push("/");
      }
    });
  }, [router]);

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      });
      
      if (result?.data && "redirect" in result.data && result.data.redirect) return;
      
      
      if (result?.error) {
        console.error("Error signing in with Google:", result.error);
        alert("Failed to sign in. Please check your Google OAuth configuration.");
        setIsLoading(false);
      } else {
        console.warn("Unexpected response from signIn.social:", result);
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error signing in with Google:", error);
      alert("An error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <div className="container flex flex-col items-center justify-center gap-8 px-4 py-16">
        <div className="flex flex-col items-center gap-6 rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h1 className="text-3xl font-bold tracking-tight">Sign in to Cognify</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Use your Google account to continue
          </p>
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="flex items-center gap-3 rounded-lg bg-white px-6 py-3 font-medium text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700 dark:hover:bg-gray-700"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {isLoading ? "Redirecting..." : "Sign in with Google"}
          </button>
        </div>
      </div>
    </main>
  );
}

