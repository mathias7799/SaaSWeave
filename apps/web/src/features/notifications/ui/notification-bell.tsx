import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";

import { client, orpc } from "@saasweave/api/client/tanstack-start/orpc";
import { Button } from "@saasweave/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from "@saasweave/ui/components/dropdown-menu";
import { cn } from "@saasweave/ui/lib/utils";

import { formatRelativeTime } from "@/shared/ui/console-kit";

export function NotificationBell() {
  const queryClient = useQueryClient();

  const unread = useQuery({
    ...orpc.console.notifications.unreadCount.queryOptions(),
    refetchInterval: 30_000
  });
  const list = useQuery(orpc.console.notifications.list.queryOptions());

  const count = unread.data?.count ?? 0;
  const notifications = list.data ?? [];

  function invalidate() {
    void queryClient.invalidateQueries({
      queryKey: orpc.console.notifications.list.queryKey()
    });
    void queryClient.invalidateQueries({
      queryKey: orpc.console.notifications.unreadCount.queryKey()
    });
  }

  const markAll = useMutation({
    mutationFn: () => client.console.notifications.markAllRead(),
    onSuccess: invalidate
  });

  function isSafeUrl(url: string): boolean {
    if (url.startsWith("/")) return true;
    try {
      const { protocol } = new URL(url);
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  }

  function open(id: string, actionUrl: string | null) {
    void client.console.notifications.markRead({ id }).then(invalidate);
    if (actionUrl && isSafeUrl(actionUrl)) window.location.assign(actionUrl);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Notifications" className="relative" size="icon-sm" variant="ghost">
          <Bell />
          {count > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {count > 9 ? "9+" : count}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <span className="text-sm font-medium text-foreground">Notifications</span>
          {count > 0 ? (
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => markAll.mutate()}
              type="button"
            >
              <CheckCheck aria-hidden="true" className="size-3.5" />
              Mark all read
            </button>
          ) : null}
        </div>

        {notifications.length > 0 ? (
          <ul className="max-h-96 overflow-y-auto py-1">
            {notifications.map((item) => (
              <li key={item.id}>
                <button
                  className={cn(
                    "flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/60",
                    item.read ? "" : "bg-primary/[0.04]"
                  )}
                  onClick={() => open(item.id, item.actionUrl)}
                  type="button"
                >
                  <span className="flex items-center gap-2">
                    {item.read ? null : (
                      <span
                        className="size-1.5 shrink-0 rounded-full bg-primary"
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-sm font-medium text-foreground">{item.title}</span>
                  </span>
                  {item.body ? (
                    <span className="line-clamp-2 text-xs text-muted-foreground">{item.body}</span>
                  ) : null}
                  <span className="text-[11px] text-muted-foreground">
                    {formatRelativeTime(item.createdAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-3 py-10 text-center text-sm text-muted-foreground">
            <Bell aria-hidden="true" className="mx-auto mb-2 size-5 opacity-40" />
            You're all caught up.
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
