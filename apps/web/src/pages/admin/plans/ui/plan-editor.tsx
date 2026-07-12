import { isDefinedError } from "@orpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@saasweave/ui/components/button";
import { Input } from "@saasweave/ui/components/input";
import { Label } from "@saasweave/ui/components/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@saasweave/ui/components/sheet";

import { plansQueryKeys, type PlansQueryResult } from "@/shared/api/get-plans.query";
import { ConfirmActionDialog } from "@/shared/ui/confirm-action-dialog";
import { Switch } from "@/shared/ui/console-kit";

import { useCreatePlanMutation } from "@/pages/admin/plans/api/create-plan.mutation";
import { useRemovePlanMutation } from "@/pages/admin/plans/api/remove-plan.mutation";
import { useUpdatePlanMutation } from "@/pages/admin/plans/api/update-plan.mutation";

export type PlanRow = PlansQueryResult[number];

type PlanDraft = {
  cta: string;
  highlights: string;
  id: string;
  name: string;
  popular: boolean;
  priceMonthly: string;
  seatPrice: string;
  seatsIncluded: string;
  tagline: string;
};

function draftFromPlan(plan?: PlanRow): PlanDraft {
  return {
    cta: plan?.cta ?? "Choose plan",
    highlights: plan?.highlights.join("\n") ?? "",
    id: plan?.id ?? "",
    name: plan?.name ?? "",
    popular: plan?.popular ?? false,
    priceMonthly: plan?.priceMonthly === null ? "" : String(plan?.priceMonthly ?? ""),
    seatPrice:
      plan?.seatPrice === undefined || plan.seatPrice === null ? "" : String(plan.seatPrice),
    seatsIncluded: String(plan?.seatsIncluded ?? 1),
    tagline: plan?.tagline ?? ""
  };
}

function toPayload(draft: PlanDraft) {
  return {
    cta: draft.cta.trim() || "Choose plan",
    highlights: draft.highlights
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
    id: draft.id.trim(),
    name: draft.name.trim(),
    popular: draft.popular,
    priceMonthly: draft.priceMonthly.trim() === "" ? null : Math.max(0, Number(draft.priceMonthly)),
    seatPrice: draft.seatPrice.trim() === "" ? null : Math.max(0, Number(draft.seatPrice)),
    seatsIncluded: Math.max(0, Number(draft.seatsIncluded) || 0),
    tagline: draft.tagline.trim()
  };
}

function PlanForm({
  draft,
  isCreate,
  onChange
}: {
  draft: PlanDraft;
  isCreate: boolean;
  onChange: (next: PlanDraft) => void;
}) {
  return (
    <div className="grid gap-4 overflow-y-auto px-4 pb-4">
      <div className="space-y-2">
        <Label htmlFor="plan-id">Plan id</Label>
        <Input
          disabled={!isCreate}
          id="plan-id"
          onChange={(event) => onChange({ ...draft, id: event.target.value })}
          placeholder="growth"
          value={draft.id}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="plan-name">Name</Label>
        <Input
          id="plan-name"
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          value={draft.name}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="plan-tagline">Tagline</Label>
        <Input
          id="plan-tagline"
          onChange={(event) => onChange({ ...draft, tagline: event.target.value })}
          value={draft.tagline}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="plan-price">Price / mo (blank = Custom)</Label>
          <Input
            id="plan-price"
            min={0}
            onChange={(event) => onChange({ ...draft, priceMonthly: event.target.value })}
            type="number"
            value={draft.priceMonthly}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="plan-seat-price">Seat add-on price</Label>
          <Input
            id="plan-seat-price"
            min={0}
            onChange={(event) => onChange({ ...draft, seatPrice: event.target.value })}
            type="number"
            value={draft.seatPrice}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="plan-seats">Seats included</Label>
        <Input
          id="plan-seats"
          min={0}
          onChange={(event) => onChange({ ...draft, seatsIncluded: event.target.value })}
          type="number"
          value={draft.seatsIncluded}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="plan-cta">Call to action</Label>
        <Input
          id="plan-cta"
          onChange={(event) => onChange({ ...draft, cta: event.target.value })}
          value={draft.cta}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="plan-highlights">Highlights (one per line)</Label>
        <textarea
          className="min-h-28 w-full rounded-lg border border-input/70 bg-background px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:ring-[1px] focus-visible:ring-border dark:bg-input/32"
          id="plan-highlights"
          onChange={(event) => onChange({ ...draft, highlights: event.target.value })}
          value={draft.highlights}
        />
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
        <span className="text-sm text-foreground">Highlight as "Popular"</span>
        <Switch
          checked={draft.popular}
          label="Toggle popular"
          onChange={(next) => onChange({ ...draft, popular: next })}
        />
      </div>
    </div>
  );
}

export function CreatePlanSheet() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PlanDraft>(() => draftFromPlan());
  const mutation = useCreatePlanMutation({
    onError: (error) => {
      if (isDefinedError(error) && error.code === "PLAN_EXISTS") {
        toast.error("A plan with this id already exists.");
        return;
      }
      toast.error(error.message || "Failed to create plan");
    },
    onSuccess: () => {
      toast.success("Plan created");
      void queryClient.invalidateQueries({ queryKey: plansQueryKeys.all() });
      setOpen(false);
      setDraft(draftFromPlan());
    }
  });

  return (
    <Sheet
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft(draftFromPlan());
      }}
      open={open}
    >
      <SheetTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden="true" />
          New plan
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>New plan</SheetTitle>
          <SheetDescription>
            Add a plan to the catalog. It appears everywhere immediately.
          </SheetDescription>
        </SheetHeader>
        <PlanForm draft={draft} isCreate onChange={setDraft} />
        <SheetFooter>
          <Button
            disabled={!draft.id.trim() || !draft.name.trim() || mutation.isPending}
            onClick={() => mutation.mutate(toPayload(draft))}
          >
            {mutation.isPending ? "Creating…" : "Create plan"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function EditPlanSheet({ plan }: { plan: PlanRow }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PlanDraft>(() => draftFromPlan(plan));
  const update = useUpdatePlanMutation({
    onError: (error) => toast.error(error.message || "Failed to update plan"),
    onSuccess: () => {
      toast.success("Plan updated");
      void queryClient.invalidateQueries({ queryKey: plansQueryKeys.all() });
      setOpen(false);
    }
  });
  const remove = useRemovePlanMutation({
    onError: (error) => {
      if (isDefinedError(error) && error.code === "PLAN_IN_USE") {
        toast.error("This plan still has workspaces subscribed to it.");
        return;
      }
      toast.error(error.message || "Failed to delete plan");
    },
    onSuccess: () => {
      toast.success("Plan deleted");
      void queryClient.invalidateQueries({ queryKey: plansQueryKeys.all() });
      setOpen(false);
    }
  });

  return (
    <Sheet
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft(draftFromPlan(plan));
      }}
      open={open}
    >
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="mt-4 w-full">
          Edit plan
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit {plan.name}</SheetTitle>
          <SheetDescription>Changes apply platform-wide as soon as you save.</SheetDescription>
        </SheetHeader>
        <PlanForm draft={draft} isCreate={false} onChange={setDraft} />
        <SheetFooter className="flex-row items-center justify-between">
          <ConfirmActionDialog
            confirmLabel="Delete plan"
            description="This removes the plan from the catalog. Workspaces currently on this plan will block the deletion."
            onConfirm={() => remove.mutate({ id: plan.id })}
            title={`Delete ${plan.name}?`}
          >
            <Button variant="outline" size="sm" disabled={remove.isPending}>
              <Trash2 className="size-4" aria-hidden="true" />
              Delete
            </Button>
          </ConfirmActionDialog>
          <Button disabled={update.isPending} onClick={() => update.mutate(toPayload(draft))}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
