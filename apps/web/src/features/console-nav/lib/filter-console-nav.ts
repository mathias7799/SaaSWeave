import {
  type ConsoleNavGroup,
  type ConsoleNavItem
} from "@/features/console-nav/config/console-nav.config";

export function filterConsoleNavByFeatures(
  groups: ConsoleNavGroup[],
  enabledFeatureKeys: ReadonlySet<string>
): ConsoleNavGroup[] {
  return groups
    .map((group) => {
      return {
        ...group,
        items: group.items.filter(
          (item) => !item.featureKey || enabledFeatureKeys.has(item.featureKey)
        )
      };
    })
    .filter((group) => group.items.length > 0);
}

export function collectEnabledFeatureKeys(
  features: Array<{ enabledForOrg: boolean; key: string }>
): Set<string> {
  return new Set(features.filter((feature) => feature.enabledForOrg).map((feature) => feature.key));
}

export type { ConsoleNavItem };
