import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@saasweave/ui/components/button";

import { auditMessages, consoleCommonMessages } from "@/shared/lib/console-messages";
import { AuditEventList } from "@/shared/ui/audit-event-list";
import {
  ConsoleEmptyState,
  ConsoleErrorState,
  ConsoleSkeleton,
  Panel,
  PanelHeader,
  SectionHeading
} from "@/shared/ui/console-kit";

import { useExportAuditMutation } from "@/pages/console/audit/api/export-audit.mutation";
import { useGetConsoleAuditLogQuery } from "@/pages/console/audit/api/get-audit-log.query";
import { useGetConsoleFeaturesQuery } from "@/pages/console/features/api/get-features.query";

function downloadExport(result: {
  content: string;
  contentType: string;
  filename: string;
  rowCount: number;
}) {
  const blob = new Blob([result.content], { type: result.contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = result.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AuditPage() {
  const query = useGetConsoleAuditLogQuery();
  const featuresQuery = useGetConsoleFeaturesQuery();
  const exportEnabled = featuresQuery.data?.some(
    (feature) => feature.key === "audit_export" && feature.enabledForOrg
  );

  const exportMutation = useExportAuditMutation({
    onError: (error: Error) => toast.error(error.message || auditMessages.exportFailed()),
    onSuccess: (result) => {
      downloadExport(result);
      toast.success(auditMessages.exportSuccess({ count: result.rowCount }));
    }
  });

  if (query.isError) {
    return (
      <ConsoleErrorState
        description={auditMessages.errorDescription()}
        onRetry={() => query.refetch()}
      />
    );
  }
  if (!query.data) return <ConsoleSkeleton />;

  const entries = query.data;

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow={consoleCommonMessages.workspaceEyebrow()}
        title={auditMessages.title()}
        description={auditMessages.description()}
      />

      <Panel>
        <PanelHeader
          title={auditMessages.recentEventsTitle()}
          description={consoleCommonMessages.entriesCount({ count: entries.length })}
          action={
            exportEnabled ? (
              <Button
                disabled={exportMutation.isPending || entries.length === 0}
                onClick={() => exportMutation.mutate({ format: "csv" })}
                size="sm"
                variant="outline"
              >
                <Download className="size-4" aria-hidden="true" />
                {exportMutation.isPending ? auditMessages.exporting() : auditMessages.exportCsv()}
              </Button>
            ) : null
          }
        />
        {entries.length > 0 ? (
          <AuditEventList
            actorLabel={(name) => consoleCommonMessages.byActor({ name })}
            entries={entries}
          />
        ) : (
          <ConsoleEmptyState
            description={auditMessages.emptyDescription()}
            title={auditMessages.emptyTitle()}
          />
        )}
      </Panel>
    </div>
  );
}
