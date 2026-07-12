import { useQueryClient } from "@tanstack/react-query";
import { Mail, RotateCcw, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@saasweave/ui/components/button";
import { Input } from "@saasweave/ui/components/input";
import { Label } from "@saasweave/ui/components/label";
import { cn } from "@saasweave/ui/lib/utils";

import {
  ConsoleSkeleton,
  formatRelativeTime,
  Panel,
  PanelHeader,
  SectionHeading
} from "@/shared/ui/console-kit";

import {
  emailDeliveriesQueryKeys,
  useGetEmailDeliveriesQuery
} from "@/pages/admin/emails/api/get-email-deliveries.query";
import {
  emailTemplatesQueryKeys,
  useGetEmailTemplatesQuery
} from "@/pages/admin/emails/api/get-email-templates.query";
import { previewEmailTemplate } from "@/pages/admin/emails/api/preview-email-template";
import { useSaveEmailTemplateMutation } from "@/pages/admin/emails/api/save-email-template.mutation";
import { useSendTestEmailMutation } from "@/pages/admin/emails/api/send-test-email.mutation";

type TemplateField = {
  key: string;
  label: string;
  kind: "copy" | "data";
  multiline: boolean;
  default: string;
  value: string;
};

type TemplateSummary = {
  key: string;
  name: string;
  description: string;
  subject: string;
  subjectDefault: string;
  fields: TemplateField[];
};

/** A draft holds the operator's in-progress subject + copy edits for a template. */
type Draft = { subject: string; copy: Record<string, string> };

function draftFromTemplate(template: TemplateSummary): Draft {
  const copy: Record<string, string> = {};
  for (const field of template.fields) {
    if (field.kind === "copy") copy[field.key] = field.value;
  }
  return { copy, subject: template.subject };
}

export function AdminEmailsPage() {
  const query = useGetEmailTemplatesQuery();

  if (!query.data) return <ConsoleSkeleton />;

  return <EmailsEditor templates={query.data} />;
}

function EmailsEditor({ templates }: { templates: TemplateSummary[] }) {
  const [activeKey, setActiveKey] = useState(templates[0]?.key ?? "");
  const active = templates.find((template) => template.key === activeKey) ?? templates[0];

  if (!active) return null;

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Platform"
        title="Transactional emails"
        description="Edit the copy your customers receive, preview the rendered email, and send yourself a test. Changes are saved as overrides — reset any field to fall back to the default."
      />

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <TemplateList active={activeKey} onSelect={setActiveKey} templates={templates} />
        {/* Keyed remount resets the draft cleanly when the operator switches templates. */}
        <TemplateEditor key={active.key} template={active} />
      </div>

      <DeliveriesPanel />
    </div>
  );
}

const DELIVERY_STATUS: Record<string, { label: string; className: string }> = {
  failed: { className: "bg-destructive/10 text-destructive", label: "Failed" },
  logged: { className: "bg-amber-500/10 text-amber-600 dark:text-amber-500", label: "Logged" },
  sent: { className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500", label: "Sent" }
};

function DeliveriesPanel() {
  const query = useGetEmailDeliveriesQuery();
  const deliveries = query.data ?? [];

  return (
    <Panel>
      <PanelHeader
        title="Recent deliveries"
        description="Every transactional send, newest first. “Logged” means console mode — no provider configured."
      />
      {deliveries.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5 font-medium">Template</th>
                <th className="px-5 py-2.5 font-medium">Recipient</th>
                <th className="px-5 py-2.5 font-medium">Subject</th>
                <th className="px-5 py-2.5 text-right font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {deliveries.map((delivery) => {
                const status = DELIVERY_STATUS[delivery.status] ?? {
                  className: "bg-muted text-muted-foreground",
                  label: delivery.status
                };
                return (
                  <tr key={delivery.id}>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          status.className
                        )}
                        title={delivery.error ?? undefined}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                        {delivery.templateKey}
                      </code>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{delivery.recipient}</td>
                    <td className="max-w-[240px] truncate px-5 py-3 text-foreground">
                      {delivery.subject}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-muted-foreground">
                      {formatRelativeTime(delivery.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">
          No deliveries yet. Send a test above to see it appear here.
        </p>
      )}
    </Panel>
  );
}

function TemplateEditor({ template }: { template: TemplateSummary }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => draftFromTemplate(template));
  const [preview, setPreview] = useState<{ html: string; subject: string } | null>(null);
  const [testEmail, setTestEmail] = useState("");

  // Live preview: re-render (debounced) whenever the draft changes.
  useEffect(() => {
    const handle = setTimeout(() => {
      void previewEmailTemplate({ copy: draft.copy, key: template.key, subject: draft.subject })
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 250);
    return () => clearTimeout(handle);
  }, [template.key, draft]);

  const save = useSaveEmailTemplateMutation({
    onError: (error: Error) => toast.error(error.message),
    onSuccess: () => {
      toast.success("Template saved");
      void queryClient.invalidateQueries({ queryKey: emailTemplatesQueryKeys.all() });
    }
  });

  const sendTest = useSendTestEmailMutation({
    onError: (error: Error) => toast.error(error.message),
    onSuccess: () => {
      toast.success(`Test sent to ${testEmail}`);
      void queryClient.invalidateQueries({ queryKey: emailDeliveriesQueryKeys.all() });
    }
  });

  const isDirty = useMemo(() => {
    if (draft.subject !== template.subject) return true;
    return template.fields.some(
      (field) => field.kind === "copy" && draft.copy[field.key] !== field.value
    );
  }, [template, draft]);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel className="flex flex-col">
        <PanelHeader title={template.name} description={template.description} />
        <div className="space-y-5 px-5 py-5">
          <SubjectField
            onChange={(subject) =>
              setDraft((prev) => {
                return { ...prev, subject };
              })
            }
            onReset={() =>
              setDraft((prev) => {
                return { ...prev, subject: template.subjectDefault };
              })
            }
            placeholder={template.subjectDefault}
            value={draft.subject}
          />

          {template.fields
            .filter((field) => field.kind === "copy")
            .map((field) => (
              <CopyField
                field={field}
                key={field.key}
                onChange={(value) =>
                  setDraft((prev) => {
                    return { ...prev, copy: { ...prev.copy, [field.key]: value } };
                  })
                }
                onReset={() =>
                  setDraft((prev) => {
                    return {
                      ...prev,
                      copy: { ...prev.copy, [field.key]: field.default }
                    };
                  })
                }
                value={draft.copy[field.key] ?? field.default}
              />
            ))}

          <div className="flex items-center gap-3 border-t border-border pt-5">
            <Button
              disabled={!isDirty || save.isPending}
              onClick={() =>
                save.mutate({ copy: draft.copy, key: template.key, subject: draft.subject })
              }
            >
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
            {isDirty ? (
              <span className="text-xs text-muted-foreground">Unsaved changes</span>
            ) : null}
          </div>

          <div className="space-y-2 border-t border-border pt-5">
            <Label htmlFor="test-email">Send a test</Label>
            <div className="flex gap-2">
              <Input
                id="test-email"
                onChange={(event) => setTestEmail(event.target.value)}
                placeholder="you@example.com"
                type="email"
                value={testEmail}
              />
              <Button
                disabled={!testEmail || sendTest.isPending}
                onClick={() => sendTest.mutate({ key: template.key, to: testEmail })}
                variant="outline"
              >
                <Send aria-hidden="true" />
                {sendTest.isPending ? "Sending…" : "Send"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Uses default field values. With no mail provider configured, the send is logged
              instead (console mode).
            </p>
          </div>
        </div>
      </Panel>

      <Panel className="flex flex-col overflow-hidden">
        <PanelHeader title="Preview" description={preview ? preview.subject : "Rendering…"} />
        <div className="flex-1 bg-muted/40 p-4">
          {preview ? (
            <iframe
              className="h-[520px] w-full rounded-lg border border-border bg-white"
              sandbox=""
              srcDoc={preview.html}
              title="Email preview"
            />
          ) : (
            <div className="flex h-[520px] items-center justify-center text-sm text-muted-foreground">
              <Mail aria-hidden="true" className="mr-2 size-4" />
              No preview available
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

function TemplateList({
  active,
  onSelect,
  templates
}: {
  active: string;
  onSelect: (key: string) => void;
  templates: TemplateSummary[];
}) {
  return (
    <nav
      className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible"
      aria-label="Templates"
    >
      {templates.map((template) => (
        <button
          className={cn(
            "shrink-0 rounded-lg border px-3.5 py-2.5 text-left transition-colors lg:shrink",
            template.key === active
              ? "border-primary/40 bg-primary/5 text-foreground"
              : "border-border bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          )}
          key={template.key}
          onClick={() => onSelect(template.key)}
          type="button"
        >
          <span className="block text-sm font-medium">{template.name}</span>
        </button>
      ))}
    </nav>
  );
}

function SubjectField({
  onChange,
  onReset,
  placeholder,
  value
}: {
  onChange: (value: string) => void;
  onReset: () => void;
  placeholder: string;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <FieldLabel label="Subject line" onReset={onReset} showReset={value !== placeholder} />
      <Input
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </div>
  );
}

function CopyField({
  field,
  onChange,
  onReset,
  value
}: {
  field: TemplateField;
  onChange: (value: string) => void;
  onReset: () => void;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <FieldLabel label={field.label} onReset={onReset} showReset={value !== field.default} />
      {field.multiline ? (
        <textarea
          className="min-h-24 w-full rounded-lg border border-input/70 bg-background px-3 py-2 text-sm shadow-xs outline-none [transition:box-shadow_150ms_ease-out] placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:ring-[1px] focus-visible:ring-border dark:bg-input/32"
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
      ) : (
        <Input onChange={(event) => onChange(event.target.value)} value={value} />
      )}
    </div>
  );
}

function FieldLabel({
  label,
  onReset,
  showReset
}: {
  label: string;
  onReset: () => void;
  showReset: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label>{label}</Label>
      {showReset ? (
        <button
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={onReset}
          type="button"
        >
          <RotateCcw aria-hidden="true" className="size-3" />
          Reset
        </button>
      ) : null}
    </div>
  );
}
