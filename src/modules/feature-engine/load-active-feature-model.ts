import { FeatureStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type LoadedModelFeature = {
  id: number;
  key: string;
  name: string;
  minimumValue: number;
  maximumValue: number;
  higherIsBetter: boolean;
  weight: number;
};

export type LoadedFeatureModel = {
  id: number;
  name: string;
  version: string;
  features: LoadedModelFeature[];
};

export async function loadActiveFeatureModel(): Promise<LoadedFeatureModel> {
  const model = await prisma.modelVersion.findFirst({
    where: {
      isActive: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      featureWeights: {
        include: {
          feature: true,
        },
        orderBy: {
          feature: {
            key: "asc",
          },
        },
      },
    },
  });

  if (!model) {
    throw new Error(
      "Aktif model bulunamadı. Önce pnpm exec prisma db seed çalıştırılmalıdır.",
    );
  }

  const features: LoadedModelFeature[] = [];

  for (const item of model.featureWeights) {
    const feature = item.feature;

    if (feature.status !== FeatureStatus.ACTIVE) {
      continue;
    }

    if (
      feature.minimumValue === null ||
      feature.maximumValue === null ||
      feature.higherIsBetter === null
    ) {
      continue;
    }

    features.push({
      id: feature.id,
      key: feature.key,
      name: feature.name,
      minimumValue: feature.minimumValue,
      maximumValue: feature.maximumValue,
      higherIsBetter: feature.higherIsBetter,
      weight: item.weight,
    });
  }

  if (features.length === 0) {
    throw new Error(
      `${model.version} modelinde kullanılabilir aktif feature bulunamadı.`,
    );
  }

  return {
    id: model.id,
    name: model.name,
    version: model.version,
    features,
  };
}