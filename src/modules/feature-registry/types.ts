import type {
  FeatureCategory,
  FeatureScope,
  FeatureStatus,
  FeatureValueType,
} from "@/generated/prisma/client";

export type FeatureRegistryDefinition = {
  key: string;
  name: string;
  description: string;

  scope: FeatureScope;
  category: FeatureCategory;
  valueType: FeatureValueType;
  status: FeatureStatus;

  unit?: string | null;

  minimumValue?: number | null;
  maximumValue?: number | null;

  higherIsBetter?: boolean | null;

  availableBeforeMatch: boolean;

  requiredDataSource?: string | null;

  calculationVersion: string;
};