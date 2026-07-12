import { Check, Languages } from "lucide-react";

import { m } from "@saasweave/i18n/messages";
import { locales } from "@saasweave/i18n/runtime";
import { useLocale } from "@saasweave/i18n/tanstack-start/components/locale-provider";
import { type ButtonProps } from "@saasweave/ui/components/button";
import { Button } from "@saasweave/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@saasweave/ui/components/dropdown-menu";
import { cn } from "@saasweave/ui/lib/utils";

type LocaleSwitcherProps = {
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
};

export function LocaleSwitcher({
  size = "icon",
  variant = "ghost",
  className
}: LocaleSwitcherProps) {
  const { locale: currentLocale, switchLocale } = useLocale();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Switch language" className={className} size={size} variant={variant}>
          <Languages aria-hidden="true" size={18} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((locale) => {
          const isActive = locale === currentLocale;
          return (
            <DropdownMenuItem
              key={locale}
              className={cn("cursor-pointer gap-2", isActive && "bg-accent")}
              onClick={() => switchLocale(locale)}
            >
              <span className="flex-1">{m.language_name(undefined, { locale })}</span>
              {isActive && <Check aria-hidden="true" className="opacity-60" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
