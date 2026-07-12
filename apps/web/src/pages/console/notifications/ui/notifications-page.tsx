import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { client, orpc } from "@saasweave/api/client/tanstack-start/orpc";
import { Button } from "@saasweave/ui/components/button";
import { cn } from "@saasweave/ui/lib/utils";

import { consoleCommonMessages, notificationsMessages } from "@/shared/lib/console-messages";
import {
  ConsoleErrorState,
  ConsoleSkeleton,
  formatRelativeTime,
  SectionHeading
} from "@/shared/ui/console-kit";

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const list = useQuery(orpc.console.notifications.list.queryOptions());

  const markAll = useMutation({
    mutationFn: () => client.console.notifications.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orpc.console.notifications.list.queryKey()
      });
      void queryClient.invalidateQueries({
        queryKey: orpc.console.notifications.unreadCount.queryKey()
      });
    }
  });

  function open(id: string, actionUrl: string | null) {
    void client.console.notifications.markRead({ id }).then(() => {
      void queryClient.invalidateQueries({
        queryKey: orpc.console.notifications.list.queryKey()
      });
      void queryClient.invalidateQueries({
        queryKey: orpc.console.notifications.unreadCount.queryKey()
      });
    });
    if (actionUrl) window.location.assign(actionUrl);
  }

  if (list.isError) {
    return (
      <ConsoleErrorState
        description={notificationsMessages.errorDescription()}
        onRetry={() => list.refetch()}
      />
    );
  }

  if (!list.data) return <ConsoleSkeleton />;

  return (
    <div className="space-y-6">
      <SectionHeading
        description={notificationsMessages.description()}
        eyebrow={consoleCommonMessages.inboxEyebrow()}
        title={notificationsMessages.title()}
        action={
          list.data.some((item) => !item.read) ? (
            <Button
              disabled={markAll.isPending}
              onClick={() => markAll.mutate()}
              size="sm"
              variant="outline"
            >
              {notificationsMessages.markAllRead()}
            </Button>
          ) : null
        }
      />

      {list.data.length > 0 ? (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {list.data.map((item) => (
            <li key={item.id}>
              <button
                className={cn(
                  "flex w-full flex-col gap-1 px-4 py-4 text-left transition-colors hover:bg-muted/50",
                  item.read ? "" : "bg-primary/[0.03]"
                )}
                onClick={() => open(item.id, item.actionUrl)}
                type="button"
              >
                <span className="text-sm font-medium text-foreground">{item.title}</span>
                {item.body ? (
                  <span className="text-sm text-muted-foreground">{item.body}</span>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(item.createdAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground">
          {notificationsMessages.empty()}
        </div>
      )}
    </div>
  );
}
