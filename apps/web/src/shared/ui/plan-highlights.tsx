import { Check } from "lucide-react";

export function PlanHighlights({ highlights }: { highlights: string[] }) {
  return (
    <ul className="mt-4 flex-1 space-y-2">
      {highlights.map((highlight) => (
        <li key={highlight} className="flex items-start gap-2 text-sm text-muted-foreground">
          <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
          {highlight}
        </li>
      ))}
    </ul>
  );
}
