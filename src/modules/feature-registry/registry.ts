import type {
  FeatureRegistryDefinition,
} from "./types";

const registry =
  new Map<
    string,
    FeatureRegistryDefinition
  >();

export function registerFeature(
  definition: FeatureRegistryDefinition,
): void {
  if (!definition.key.trim()) {
    throw new Error(
      "Feature key boş olamaz.",
    );
  }

  if (registry.has(definition.key)) {
    throw new Error(
      `Feature zaten kayıtlı: ${definition.key}`,
    );
  }

  registry.set(
    definition.key,
    definition,
  );
}

export function getRegisteredFeature(
  key: string,
): FeatureRegistryDefinition | undefined {
  return registry.get(key);
}

export function getRegisteredFeatures():
  FeatureRegistryDefinition[] {
  return [...registry.values()];
}

export function hasRegisteredFeature(
  key: string,
): boolean {
  return registry.has(key);
}

export function clearFeatureRegistry():
  void {
  registry.clear();
}