import { LogOut } from "lucide-react";

import { useAuthSuspense } from "@saasweave/auth/react/tanstack-start/hooks";
import { Link } from "@saasweave/i18n/tanstack-start/components/link";
import { Avatar, AvatarFallback, AvatarImage } from "@saasweave/ui/components/avatar";
import { Button } from "@saasweave/ui/components/button";
import { useIsClient } from "@saasweave/ui/hooks/use-is-client.hook";

import { useSignOut } from "@/shared/lib/use-sign-out";

export function ConsoleUserMenu() {
  const isClient = useIsClient();
  const { user } = useAuthSuspense();
  const handleSignOut = useSignOut();

  if (!user) return null;

  return (
    <div className="flex items-center gap-1">
      <Button
        aria-label="Account settings"
        asChild
        className="rounded-full"
        size="icon-sm"
        variant="ghost"
      >
        <Link to="/app/settings">
          <Avatar className="size-7">
            <AvatarImage src={user.image ?? undefined} alt={user.name} />
            <AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Link>
      </Button>
      <Button
        aria-label="Sign out"
        disabled={!isClient}
        onClick={handleSignOut}
        size="icon-sm"
        variant="ghost"
      >
        <LogOut aria-hidden="true" />
      </Button>
    </div>
  );
}
