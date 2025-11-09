"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut } from "lucide-react";
import { api } from "@/trpc/react";
import { useRouter } from "next/navigation";

interface UserMenuProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function UserMenu({ user }: UserMenuProps) {
  const router = useRouter();
  const signOutMutation = api.auth.signOut.useMutation({
    onSuccess: () => {
      router.refresh();
      router.push("/");
    },
  });

  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() ?? "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="w-full outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
        <div className="flex items-center gap-3 px-2 py-2 hover:bg-sidebar-accent rounded-md transition-colors">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.image ?? undefined} alt={user.name ?? "User"} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start flex-1 min-w-0">
            <p className="text-sm font-medium truncate w-full text-left">
              {user.name ?? "User"}
            </p>
            <p className="text-xs text-muted-foreground truncate w-full text-left">
              {user.email}
            </p>
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={() => signOutMutation.mutate()}
          disabled={signOutMutation.isPending}
          className="cursor-pointer"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>{signOutMutation.isPending ? "Signing out..." : "Sign out"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

