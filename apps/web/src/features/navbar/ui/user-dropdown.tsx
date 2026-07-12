import { FileText, BarChart2, Lock, LogOut, UserSquare } from "lucide-react";
import { useState } from "react";

import { useAuthSuspense } from "@saasweave/auth/react/tanstack-start/hooks";
import { m } from "@saasweave/i18n/messages";
import { Link } from "@saasweave/i18n/tanstack-start/components/link";
import { Button } from "@saasweave/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@saasweave/ui/components/dropdown-menu";
import { useIsClient } from "@saasweave/ui/hooks/use-is-client.hook";

import { useSignOut } from "@/shared/lib/use-sign-out";

import { NavbarAvatar } from "@/features/navbar/ui/navbar-avatar";
import { NavbarUnauthenticatedButtons } from "@/features/navbar/ui/navbar-unauthenticated-buttons";

export function UserDropdown() {
  const isClient = useIsClient();
  const [open, setOpen] = useState(false);
  const { user } = useAuthSuspense();

  const handleSignOut = useSignOut();

  if (!user) {
    return <NavbarUnauthenticatedButtons />;
  }

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Open account menu"
          disabled={!isClient}
          onPointerDown={() => setOpen(true)}
          size="icon"
          variant="ghost"
        >
          <UserSquare aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-w-sm min-w-fit">
        <DropdownMenuLabel className="flex items-start gap-3">
          <NavbarAvatar avatarImgSrc={user.image} name={user.name} email={user.email} />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to="/app">
              <BarChart2 aria-hidden="true" className="opacity-60" size={16} />
              <span>{m.user_dropdown__dashboard()}</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to="/privacy-policy">
              <Lock aria-hidden="true" className="opacity-60" size={16} />
              <span>{m.user_dropdown__privacy_policy()}</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to="/terms-of-service">
              <FileText aria-hidden="true" className="opacity-60" size={16} />
              <span>{m.user_dropdown__terms_of_service()}</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" variant="destructive" onClick={handleSignOut}>
          <LogOut aria-hidden="true" className="opacity-60" />
          <button onClick={handleSignOut}>{m.user_dropdown__logout()}</button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
