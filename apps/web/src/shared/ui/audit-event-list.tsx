import { auditIcon, auditSentence, type AuditEntryView } from "@/shared/ui/audit";
import { formatRelativeTime } from "@/shared/ui/console-kit";

type AuditEventListProps = {
  actorLabel: (name: string) => string;
  entries: AuditEntryView[];
};

export function AuditEventList({ actorLabel, entries }: AuditEventListProps) {
  return (
    <ul className="divide-y divide-border">
      {entries.map((entry) => {
        const Icon = auditIcon(entry.action);
        return (
          <li key={entry.id} className="flex items-start gap-3 px-5 py-3.5">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">{auditSentence(entry)}</p>
              <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{entry.action}</code>
                {entry.actorName ? <span>{actorLabel(entry.actorName)}</span> : null}
                <span>· {formatRelativeTime(entry.createdAt)}</span>
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
