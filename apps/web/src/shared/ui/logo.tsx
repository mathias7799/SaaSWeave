import type React from "react";

import { cn } from "@saasweave/ui/lib/utils";

import { appConfig } from "@/config/app.config";

/**
 * SaaSWeave mark — a rounded tile with a notch carved from the corner and a void
 * at its center: a "niche" cut from a whole. The cuts are real transparency
 * (mask), so the mark sits on any background in light or dark.
 */
export function LogoIcon({
  className,
  maskId = "saasweave-mark",
  ...props
}: React.SVGProps<SVGSVGElement> & { maskId?: string }) {
  return (
    <svg
      {...props}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("text-brand", className)}
    >
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
        <rect width="32" height="32" rx="8.5" fill="white" />
        <circle cx="31" cy="1" r="8.5" fill="black" />
        <circle cx="16" cy="16" r="4.25" fill="black" />
      </mask>
      <rect width="32" height="32" rx="8.5" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  );
}

export function LogoWordmark({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn("flex items-center gap-2 text-lg font-semibold tracking-tight", className)}
    >
      <LogoIcon className="size-6" maskId="saasweave-wordmark" />
      <span>
        <span className="text-muted-foreground">By</span>
        <span className="text-foreground">{appConfig.site.shortName.replace(/^By/, "")}</span>
      </span>
    </div>
  );
}
