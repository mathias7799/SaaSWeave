import { AuditEventList } from "@/shared/ui/audit-event-list";
import { ConsoleSkeleton, Panel, PanelHeader, SectionHeading } from "@/shared/ui/console-kit";

import { useGetAuditLogQuery } from "@/pages/admin/audit/api/get-audit-log.query";

export function AdminAuditPage() {
  const query = useGetAuditLogQuery();

  if (!query.data) return <ConsoleSkeleton />;
  const entries = query.data;

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Platform"
        title="Audit log"
        description="Every security- and billing-relevant action across all workspaces, newest first."
      />

      <Panel>
        <PanelHeader title="Recent events" description={`${entries.length} entries`} />
        {entries.length > 0 ? (
          <AuditEventList actorLabel={(name) => `by ${name}`} entries={entries} />
        ) : (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            No audit events yet.
          </p>
        )}
      </Panel>
    </div>
  );
}
