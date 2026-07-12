import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  ImageIcon,
  Languages,
  RefreshCw,
  ShieldCheck,
  Terminal,
  TriangleAlert
} from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@saasweave/api/client/tanstack-start/orpc";
import { resolvePublicAssetUrl } from "@saasweave/core/assets";
import { m } from "@saasweave/i18n/messages";
import { Link } from "@saasweave/i18n/tanstack-start/components/link";
import { type To } from "@saasweave/i18n/tanstack-start/types";
import { Button } from "@saasweave/ui/components/button";
import { useIsClient } from "@saasweave/ui/hooks/use-is-client.hook";

import { generateAppSeo } from "@/shared/lib/seo";
import { useLogger } from "@/shared/providers/logger-provider";
import { Badge } from "@/shared/ui/console-kit";
import { Container } from "@/shared/ui/container";
import { Image } from "@/shared/ui/image";

import { appConfig } from "@/config/app.config";

export const Route = createFileRoute("/{-$locale}/(root-layout)/playground/")({
  head: ({ params }) =>
    generateAppSeo({
      alternates: { canonicalPath: "/playground", locale: params.locale },
      description: `Inspect the live runtime workbench for ${appConfig.site.shortName}.`,
      robots: { follow: false, index: false },
      title: "Runtime workbench"
    }),
  component: PlaygroundPage
});

function RuntimeSignal({
  icon: Icon,
  label,
  state,
  tone = "neutral"
}: {
  icon: typeof Activity;
  label: string;
  state: string;
  tone?: "brand" | "destructive" | "info" | "neutral" | "success";
}) {
  return (
    <div className="min-h-28 border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        <Badge tone={tone}>{state}</Badge>
      </div>
      <p className="mt-8 text-sm font-medium text-foreground">{label}</p>
    </div>
  );
}

function PlaygroundPage() {
  const { locale } = Route.useParams();
  const isClient = useIsClient();
  const healthCheck = useQuery({
    ...orpc.health.live.queryOptions(),
    enabled: isClient,
    retry: false
  });
  const logger = useLogger();
  const backgroundImageSrc = resolvePublicAssetUrl(import.meta.env.BASE_URL, "/img/bg.jpg");
  const connected = isClient && healthCheck.isSuccess;
  const apiState =
    !isClient || healthCheck.isLoading
      ? m.playground_page__checking()
      : connected
        ? m.playground_page__connected()
        : m.playground_page__disconnected();

  return (
    <Container className="space-y-10 pb-16 pt-8 sm:pt-12">
      <header className="flex flex-col justify-between gap-5 border-b border-border pb-8 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-brand">{m.playground_page__runtime()}</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-foreground sm:text-4xl">
            {m.playground_page__workbench()}
          </h1>
        </div>
        <Button
          variant="outline"
          disabled={healthCheck.isFetching}
          onClick={() => void healthCheck.refetch()}
        >
          <RefreshCw
            className={healthCheck.isFetching ? "animate-spin" : undefined}
            aria-hidden="true"
          />
          {m.playground_page__refetch()}
        </Button>
      </header>

      <section aria-labelledby="runtime-signals">
        <h2 id="runtime-signals" className="sr-only">
          {m.playground_page__runtime_signals()}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <RuntimeSignal
            icon={Activity}
            label={m.playground_page__api_status()}
            state={apiState}
            tone={connected ? "success" : healthCheck.isError ? "destructive" : "neutral"}
          />
          <RuntimeSignal
            icon={ShieldCheck}
            label={m.playground_page__hydration()}
            state={isClient ? m.playground_page__active() : m.playground_page__server_rendered()}
            tone={isClient ? "info" : "neutral"}
          />
          <RuntimeSignal
            icon={Languages}
            label={m.playground_page__locale()}
            state={(locale ?? "en").toUpperCase()}
            tone="brand"
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 border-y border-border py-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.8fr)] lg:items-stretch">
        <div className="relative aspect-[16/9] min-h-64 overflow-hidden bg-muted lg:aspect-auto">
          <Image
            width={1_472}
            height={828}
            quality={72}
            priority
            className="size-full object-cover"
            src={backgroundImageSrc}
            alt={m.playground_page__background()}
            placeholder="blur"
          />
        </div>
        <div className="flex min-h-64 flex-col justify-between border border-border p-5">
          <div>
            <ImageIcon className="size-5 text-brand" aria-hidden="true" />
            <h2 className="mt-5 font-display text-2xl font-semibold text-foreground">
              {m.playground_page__image_optimization()}
            </h2>
          </div>
          <dl className="grid grid-cols-2 gap-4 border-t border-border pt-5 text-sm">
            <div>
              <dt className="text-muted-foreground">{m.playground_page__format()}</dt>
              <dd className="mt-1 font-medium text-foreground">WebP</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{m.playground_page__quality()}</dt>
              <dd className="mt-1 font-medium text-foreground">72</dd>
            </div>
          </dl>
        </div>
      </section>

      <section aria-labelledby="interaction-lab" className="space-y-4">
        <div className="flex items-center gap-2">
          <Terminal className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 id="interaction-lab" className="text-sm font-semibold text-foreground">
            {m.playground_page__interaction_lab()}
          </h2>
        </div>
        <div className="flex min-h-24 flex-wrap items-center gap-3 border border-border p-4">
          <Button onClick={() => toast.info(m.playground_page__test_toast_message())}>
            {m.playground_page__test_toast()}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              logger.debug("playground", "Throwing test error from runtime workbench");
              throw new Error("Playground boundary test");
            }}
          >
            <TriangleAlert aria-hidden="true" />
            {m.playground_page__throw_error()}
          </Button>
          <Button variant="outline" asChild>
            <Link to={"/not-found" as To}>{m.playground_page__visit_not_found_page()}</Link>
          </Button>
          <Button variant="destructive" asChild>
            <Link to="/error">{m.playground_page__visit_error_page()}</Link>
          </Button>
        </div>
      </section>
    </Container>
  );
}
