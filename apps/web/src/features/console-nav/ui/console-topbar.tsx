import { Menu } from "lucide-react";
import type React from "react";
import { Suspense, useState } from "react";

import { Link } from "@saasweave/i18n/tanstack-start/components/link";
import { type LinkProps } from "@saasweave/i18n/tanstack-start/components/link";
import { Button } from "@saasweave/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@saasweave/ui/components/sheet";

import { LocaleSwitcher } from "@/shared/ui/locale-switcher";
import { LogoWordmark } from "@/shared/ui/logo";
import { ThemeSwitcher } from "@/shared/ui/theme-switcher";

import { type ConsoleNavGroup } from "@/features/console-nav/config/console-nav.config";
import { ConsoleNavList } from "@/features/console-nav/ui/console-nav-list";
import { ConsoleUserMenu } from "@/features/console-nav/ui/console-user-menu";

export function ConsoleTopbar({
  groups,
  homeTo,
  ariaLabel,
  badge,
  actions
}: {
  groups: ConsoleNavGroup[];
  homeTo: LinkProps["to"];
  ariaLabel: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6">
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 gap-0 p-0">
          <SheetHeader className="h-16 justify-center border-b border-border px-5">
            <SheetTitle asChild>
              <LogoWordmark className="text-base" />
            </SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto p-3">
            <ConsoleNavList
              groups={groups}
              ariaLabel={ariaLabel}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Link to={homeTo} className="flex items-center gap-2 lg:hidden">
        <LogoWordmark className="text-base" />
      </Link>

      {badge ? <div className="hidden lg:flex">{badge}</div> : null}

      <div className="ml-auto flex items-center gap-1.5">
        {actions}
        <LocaleSwitcher size="icon-sm" />
        <ThemeSwitcher size="icon-sm" />
        <Suspense fallback={null}>
          <ConsoleUserMenu />
        </Suspense>
      </div>
    </header>
  );
}
