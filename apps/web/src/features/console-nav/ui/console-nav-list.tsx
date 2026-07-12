import { Link } from "@saasweave/i18n/tanstack-start/components/link";
import { cn } from "@saasweave/ui/lib/utils";

import {
  type ConsoleNavGroup,
  getConsoleNav
} from "@/features/console-nav/config/console-nav.config";

export function ConsoleNavList({
  groups = getConsoleNav(),
  ariaLabel = "Console",
  onNavigate
}: {
  groups?: ConsoleNavGroup[];
  ariaLabel?: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-6" aria-label={ariaLabel}>
      {groups.map((group) => (
        <div key={group.heading}>
          <p className="px-3 pb-2 text-xs font-medium tracking-wide text-muted-foreground/80 uppercase">
            {group.heading}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    preload={false}
                    activeOptions={{ exact: item.exact ?? false }}
                    onClick={onNavigate}
                    className="block"
                  >
                    {({ isActive }) => (
                      <span
                        className={cn(
                          "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-secondary text-foreground"
                            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-4 shrink-0 transition-colors",
                            isActive ? "text-brand" : "text-muted-foreground"
                          )}
                          aria-hidden="true"
                        />
                        {item.label}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
