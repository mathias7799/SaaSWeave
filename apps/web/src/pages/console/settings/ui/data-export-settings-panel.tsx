import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@saasweave/ui/components/button";

import { consoleCommonMessages, settingsMessages } from "@/shared/lib/console-messages";
import { ConsoleEmptyState, ConsoleSkeleton, Panel, PanelHeader } from "@/shared/ui/console-kit";

import { useDownloadDataExportMutation } from "@/pages/console/settings/api/download-data-export.mutation";
import { useListDataExportsQuery } from "@/pages/console/settings/api/list-data-exports.query";
import { useRequestDataExportMutation } from "@/pages/console/settings/api/request-data-export.mutation";

function statusLabel(status: "pending" | "processing" | "ready" | "failed" | "canceled") {
  switch (status) {
    case "pending":
      return settingsMessages.dataExportStatusPending();
    case "processing":
      return settingsMessages.dataExportStatusProcessing();
    case "ready":
      return settingsMessages.dataExportStatusReady();
    case "failed":
      return settingsMessages.dataExportStatusFailed();
    case "canceled":
      return consoleCommonMessages.statusCanceled();
  }
}

export function DataExportSettingsPanel() {
  const query = useListDataExportsQuery();
  const downloadMutation = useDownloadDataExportMutation();
  const requestMutation = useRequestDataExportMutation({
    onError: (error: Error) =>
      toast.error(error.message || settingsMessages.dataExportRequestFailed()),
    onSuccess: async () => {
      toast.success(settingsMessages.dataExportRequested());
      await query.refetch();
    }
  });

  if (!query.data) return <ConsoleSkeleton />;

  const exports = query.data;

  return (
    <Panel>
      <PanelHeader
        title={settingsMessages.dataExportTitle()}
        description={settingsMessages.dataExportDescription()}
        action={
          <Button
            disabled={requestMutation.isPending}
            onClick={() => requestMutation.mutate()}
            size="sm"
          >
            {requestMutation.isPending
              ? settingsMessages.dataExportRequesting()
              : settingsMessages.dataExportRequest()}
          </Button>
        }
      />
      {exports.length > 0 ? (
        <ul className="divide-y divide-border">
          {exports.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
            >
              <div className="min-w-0">
                <p className="text-sm text-foreground">{statusLabel(entry.status)}</p>
                <p className="text-xs text-muted-foreground">
                  {consoleCommonMessages.date()}: {new Date(entry.createdAt).toLocaleString()}
                </p>
                {entry.error ? (
                  <p className="mt-1 text-xs text-destructive">{entry.error}</p>
                ) : null}
              </div>
              {entry.canDownload ? (
                <Button
                  disabled={
                    downloadMutation.isPending && downloadMutation.variables?.id === entry.id
                  }
                  onClick={() => {
                    void downloadMutation
                      .mutateAsync({ id: entry.id })
                      .then((result) => {
                        window.open(result.url, "_blank", "noopener,noreferrer");
                      })
                      .catch(() => undefined);
                  }}
                  size="sm"
                  variant="outline"
                >
                  <Download className="size-4" aria-hidden="true" />
                  {settingsMessages.dataExportDownload()}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <ConsoleEmptyState
          description={settingsMessages.dataExportEmpty()}
          title={settingsMessages.dataExportTitle()}
        />
      )}
    </Panel>
  );
}
