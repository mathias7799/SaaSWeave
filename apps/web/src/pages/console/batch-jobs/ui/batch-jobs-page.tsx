import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { client, orpc } from "@saasweave/api/client/tanstack-start/orpc";
import { Button } from "@saasweave/ui/components/button";
import { Label } from "@saasweave/ui/components/label";

import { batchJobsMessages, consoleCommonMessages } from "@/shared/lib/console-messages";
import {
  ConsoleEmptyState,
  ConsoleErrorState,
  ConsoleSkeleton,
  Panel,
  PanelHeader,
  SectionHeading
} from "@/shared/ui/console-kit";

function statusLabel(
  status: "pending" | "processing" | "completed" | "failed" | "canceled"
): string {
  switch (status) {
    case "pending":
      return batchJobsMessages.statusPending();
    case "processing":
      return batchJobsMessages.statusProcessing();
    case "completed":
      return batchJobsMessages.statusCompleted();
    case "failed":
      return batchJobsMessages.statusFailed();
    case "canceled":
      return batchJobsMessages.statusCanceled();
  }
}

function CreateBatchJobForm() {
  const queryClient = useQueryClient();
  const [lines, setLines] = useState("hello\nworld");

  const mutation = useMutation({
    mutationFn: (items: Array<{ text: string }>) =>
      client.console.batches.create({ items, type: "uppercase" }),
    onError: (error) => toast.error(error.message || batchJobsMessages.createFailed()),
    onSuccess: async () => {
      toast.success(batchJobsMessages.created());
      setLines("");
      await queryClient.invalidateQueries({ queryKey: orpc.console.batches.list.queryKey() });
    }
  });

  const items = lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => {
      return { text };
    });

  return (
    <Panel>
      <PanelHeader
        description={batchJobsMessages.createDescription()}
        title={batchJobsMessages.createTitle()}
      />
      <div className="space-y-4 px-5 pb-5">
        <div className="space-y-2">
          <Label htmlFor="batch-items">{batchJobsMessages.itemsLabel()}</Label>
          <textarea
            className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            id="batch-items"
            onChange={(event) => setLines(event.target.value)}
            placeholder={batchJobsMessages.itemsPlaceholder()}
            rows={4}
            value={lines}
          />
          <p className="text-xs text-muted-foreground">{batchJobsMessages.itemsHint()}</p>
        </div>
        <Button
          disabled={items.length === 0 || mutation.isPending}
          onClick={() => mutation.mutate(items)}
        >
          <Plus className="size-4" aria-hidden="true" />
          {mutation.isPending ? batchJobsMessages.creating() : batchJobsMessages.createSubmit()}
        </Button>
      </div>
    </Panel>
  );
}

export function BatchJobsPage() {
  const queryClient = useQueryClient();
  const list = useQuery(orpc.console.batches.list.queryOptions());

  const cancel = useMutation({
    mutationFn: (input: { id: string }) => client.console.batches.cancel(input),
    onError: (error) => toast.error(error.message || batchJobsMessages.cancelFailed()),
    onSuccess: async () => {
      toast.success(batchJobsMessages.canceled());
      await queryClient.invalidateQueries({ queryKey: orpc.console.batches.list.queryKey() });
    }
  });

  if (list.isError) {
    return (
      <ConsoleErrorState
        description={batchJobsMessages.errorDescription()}
        onRetry={() => list.refetch()}
      />
    );
  }
  if (!list.data) return <ConsoleSkeleton />;

  return (
    <div className="space-y-8">
      <SectionHeading
        description={batchJobsMessages.description()}
        eyebrow={consoleCommonMessages.aiUsageEyebrow()}
        title={batchJobsMessages.title()}
      />

      <CreateBatchJobForm />

      <Panel>
        <PanelHeader
          description={batchJobsMessages.listDescription()}
          title={batchJobsMessages.listTitle()}
        />
        {list.data.length > 0 ? (
          <ul className="divide-y divide-border">
            {list.data.map((job) => (
              <li
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                key={job.id}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Layers className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {batchJobsMessages.jobTypeLabel({ type: job.type })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {statusLabel(job.status)} · {job.progressPercent}% ·{" "}
                      {batchJobsMessages.progressCounts({
                        completed: job.completedItems,
                        failed: job.failedItems,
                        total: job.totalItems
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {consoleCommonMessages.date()}: {new Date(job.createdAt).toLocaleString()}
                    </p>
                    {job.error ? (
                      <p className="mt-1 text-xs text-destructive">{job.error}</p>
                    ) : null}
                  </div>
                </div>
                {job.status === "pending" || job.status === "processing" ? (
                  <Button
                    disabled={cancel.isPending}
                    onClick={() => cancel.mutate({ id: job.id })}
                    size="sm"
                    variant="outline"
                  >
                    {batchJobsMessages.cancel()}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <ConsoleEmptyState
            description={batchJobsMessages.emptyDescription()}
            title={batchJobsMessages.emptyTitle()}
          />
        )}
      </Panel>
    </div>
  );
}
