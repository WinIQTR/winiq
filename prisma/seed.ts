import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  DataProviderCode,
  FeatureCategory,
  FeatureScope,
  FeatureStatus,
  FeatureValueType,
  PrismaClient,
} from "../src/generated/prisma/client";
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL ortam değişkeni tanımlı değil.");
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({
  adapter,
});

const dataSources = [
  {
    code: DataProviderCode.API_FOOTBALL,
    name: "API-Football",
    baseUrl: "https://v3.football.api-sports.io",
    priority: 10,
    supportsLiveData: true,
    notes: "Ana futbol fikstür, takım ve maç veri kaynağı.",
  },
  {
    code: DataProviderCode.SPORTMONKS,
    name: "Sportmonks",
    baseUrl: "https://api.sportmonks.com",
    priority: 20,
    supportsLiveData: true,
    notes: "Gelecekte kullanılabilecek alternatif futbol veri sağlayıcısı.",
  },
  {
    code: DataProviderCode.THE_ODDS_API,
    name: "The Odds API",
    baseUrl: "https://api.the-odds-api.com",
    priority: 10,
    supportsLiveData: true,
    notes: "Bahis oranları ve piyasa karşılaştırması için planlanan kaynak.",
  },
  {
    code: DataProviderCode.OPENWEATHER,
    name: "OpenWeather",
    baseUrl: "https://api.openweathermap.org",
    priority: 10,
    supportsLiveData: true,
    notes: "Stat koordinatlarına göre hava durumu verisi.",
  },
  {
    code: DataProviderCode.TRANSFERMARKT,
    name: "Transfermarkt",
    baseUrl: "https://www.transfermarkt.com",
    priority: 50,
    supportsLiveData: false,
    notes: "Piyasa değeri ve transfer bilgileri için referans kaynağı.",
  },
  {
    code: DataProviderCode.SOFASCORE,
    name: "Sofascore",
    baseUrl: "https://www.sofascore.com",
    priority: 50,
    supportsLiveData: true,
    notes: "Manuel veri doğrulaması için referans kaynağı.",
  },
  {
    code: DataProviderCode.FLASHSCORE,
    name: "Flashscore",
    baseUrl: "https://www.flashscore.com",
    priority: 50,
    supportsLiveData: true,
    notes: "Canlı skor ve sonuç doğrulaması için referans kaynağı.",
  },
  {
    code: DataProviderCode.INTERNAL,
    name: "BET Project Internal",
    baseUrl: null,
    priority: 1,
    supportsLiveData: false,
    notes: "Sistem tarafından hesaplanan özellikler, puanlar ve tahminler.",
  },
] as const;

const featureDefinitions = [
  {
    key: "last_5_points_per_game",
    name: "Son 5 Maç Puan Ortalaması",
    description: "Takımın son 5 maçında aldığı puanın maç başına ortalaması.",
    scope: FeatureScope.TEAM,
    category: FeatureCategory.RECENT_FORM,
    valueType: FeatureValueType.NUMBER,
    unit: "points_per_game",
    minimumValue: 0,
    maximumValue: 3,
    higherIsBetter: true,
    requiredDataSource: "API_FOOTBALL",
    weight: 0.2,
  },
  {
    key: "goals_scored_per_game",
    name: "Gol Ortalaması",
    description: "Takımın maç başına attığı gol.",
    scope: FeatureScope.TEAM,
    category: FeatureCategory.ATTACK,
    valueType: FeatureValueType.NUMBER,
    unit: "goals_per_game",
    minimumValue: 0,
    maximumValue: 4,
    higherIsBetter: true,
    requiredDataSource: "API_FOOTBALL",
    weight: 0.15,
  },
  {
    key: "goals_conceded_per_game",
    name: "Yenilen Gol Ortalaması",
    description: "Takımın maç başına yediği gol.",
    scope: FeatureScope.TEAM,
    category: FeatureCategory.DEFENCE,
    valueType: FeatureValueType.NUMBER,
    unit: "goals_per_game",
    minimumValue: 0,
    maximumValue: 4,
    higherIsBetter: false,
    requiredDataSource: "API_FOOTBALL",
    weight: 0.15,
  },
  {
    key: "starting_eleven_quality",
    name: "İlk 11 Kalite Puanı",
    description: "Maça başlayacak oyuncuların toplam kalite puanı.",
    scope: FeatureScope.LINEUP,
    category: FeatureCategory.PLAYER_QUALITY,
    valueType: FeatureValueType.PERCENTAGE,
    unit: "score",
    minimumValue: 0,
    maximumValue: 100,
    higherIsBetter: true,
    requiredDataSource: "INTERNAL",
    weight: 0.2,
  },
  {
    key: "expected_goals_difference",
    name: "xG Farkı",
    description: "Takımın xG ile xGA değerleri arasındaki fark.",
    scope: FeatureScope.TEAM,
    category: FeatureCategory.ATTACK,
    valueType: FeatureValueType.NUMBER,
    unit: "expected_goals",
    minimumValue: -3,
    maximumValue: 3,
    higherIsBetter: true,
    requiredDataSource: "ADVANCED_STATS",
    weight: 0.2,
  },
  {
    key: "rest_days",
    name: "Dinlenme Günü",
    description: "Takımın önceki maçından sonra dinlendiği gün sayısı.",
    scope: FeatureScope.TEAM,
    category: FeatureCategory.REST_AND_FATIGUE,
    valueType: FeatureValueType.NUMBER,
    unit: "days",
    minimumValue: 1,
    maximumValue: 10,
    higherIsBetter: true,
    requiredDataSource: "API_FOOTBALL",
    weight: 0.1,
  },

{
  key: "expected_goals_per_game",
  name: "Maç Başına Beklenen Gol",
  description:
    "Takımın mevcut sezon içinde maç başına ürettiği ortalama xG değeri.",
  scope: FeatureScope.TEAM,
  category: FeatureCategory.ATTACK,
  valueType: FeatureValueType.NUMBER,
  unit: "expected_goals",
  minimumValue: 0,
  maximumValue: 4,
  higherIsBetter: true,
  requiredDataSource: "ADVANCED_STATS",
  weight: 0.08,
},
{
  key: "expected_goals_against_per_game",
  name: "Maç Başına Beklenen Yenilen Gol",
  description:
    "Rakiplerin takıma karşı maç başına ürettiği ortalama xG değeri.",
  scope: FeatureScope.TEAM,
  category: FeatureCategory.DEFENCE,
  valueType: FeatureValueType.NUMBER,
  unit: "expected_goals",
  minimumValue: 0,
  maximumValue: 4,
  higherIsBetter: false,
  requiredDataSource: "ADVANCED_STATS",
  weight: 0.08,
},
{
  key: "last5_expected_goals",
  name: "Son 5 Maç xG Ortalaması",
  description:
    "Takımın son 5 maçta ürettiği ortalama beklenen gol değeri.",
  scope: FeatureScope.TEAM,
  category: FeatureCategory.RECENT_FORM,
  valueType: FeatureValueType.NUMBER,
  unit: "expected_goals",
  minimumValue: 0,
  maximumValue: 4,
  higherIsBetter: true,
  requiredDataSource: "ADVANCED_STATS",
  weight: 0.1,
},
{
  key: "last5_expected_goals_against",
  name: "Son 5 Maç xGA Ortalaması",
  description:
    "Rakiplerin takıma karşı son 5 maçta ürettiği ortalama xG değeri.",
  scope: FeatureScope.TEAM,
  category: FeatureCategory.RECENT_FORM,
  valueType: FeatureValueType.NUMBER,
  unit: "expected_goals",
  minimumValue: 0,
  maximumValue: 4,
  higherIsBetter: false,
  requiredDataSource: "ADVANCED_STATS",
  weight: 0.1,
},
{
  key: "last5_expected_goals_difference",
  name: "Son 5 Maç xG Farkı",
  description:
    "Takımın son 5 maçtaki xG ve xGA ortalamaları arasındaki fark.",
  scope: FeatureScope.TEAM,
  category: FeatureCategory.RECENT_FORM,
  valueType: FeatureValueType.NUMBER,
  unit: "expected_goals_difference",
  minimumValue: -3,
  maximumValue: 3,
  higherIsBetter: true,
  requiredDataSource: "ADVANCED_STATS",
  weight: 0.12,
},

] as const;



async function main(): Promise<void> {
  console.log("Veri kaynakları hazırlanıyor...");

  // 1. Veri kaynaklarını oluştur veya güncelle
  for (const source of dataSources) {
    await prisma.dataSource.upsert({
      where: {
        code: source.code,
      },
      update: {
        name: source.name,
        baseUrl: source.baseUrl,
        priority: source.priority,
        supportsLiveData: source.supportsLiveData,
        notes: source.notes,
        isActive: true,
      },
      create: {
        code: source.code,
        name: source.name,
        baseUrl: source.baseUrl,
        priority: source.priority,
        supportsLiveData: source.supportsLiveData,
        notes: source.notes,
        isActive: true,
      },
    });

    console.log(`Hazırlandı: ${source.name}`);
  }

  // 2. Aktif model sürümünü oluştur veya güncelle
  console.log("Feature kataloğu hazırlanıyor...");

  const modelVersion = await prisma.modelVersion.upsert({
    where: {
      version: "bet-model-v0.1",
    },
    update: {
      name: "BET Model MVP",
      description: "Feature Engine başlangıç modeli.",
      isActive: true,
    },
    create: {
      name: "BET Model MVP",
      version: "bet-model-v0.1",
      description: "Feature Engine başlangıç modeli.",
      isActive: true,
    },
  });

  // 3. Feature tanımlarını ve ağırlıklarını oluştur
  for (const definition of featureDefinitions) {
    const { weight, ...featureData } = definition;

    const feature = await prisma.featureDefinition.upsert({
      where: {
        key: featureData.key,
      },
      update: {
        ...featureData,
        status: FeatureStatus.ACTIVE,
        availableBeforeMatch: true,
        calculationVersion: "v0.1",
      },
      create: {
        ...featureData,
        status: FeatureStatus.ACTIVE,
        availableBeforeMatch: true,
        calculationVersion: "v0.1",
      },
    });

    await prisma.modelFeatureWeight.upsert({
      where: {
        modelVersionId_featureId: {
          modelVersionId: modelVersion.id,
          featureId: feature.id,
        },
      },
      update: {
        weight,
        learned: false,
      },
      create: {
        modelVersionId: modelVersion.id,
        featureId: feature.id,
        weight,
        learned: false,
      },
    });

    console.log(`Feature hazırlandı: ${feature.name}`);
  }

  // 4. Toplam kayıt sayılarını hesapla
  const dataSourceCount = await prisma.dataSource.count();
  const featureCount = await prisma.featureDefinition.count();
  const weightCount = await prisma.modelFeatureWeight.count();

  console.log(`Toplam veri kaynağı: ${dataSourceCount}`);
  console.log(`Toplam feature: ${featureCount}`);
  console.log(`Toplam model ağırlığı: ${weightCount}`);
  console.log("Seed işlemi başarıyla tamamlandı.");
}

main()
  .catch((error: unknown) => {
    console.error("Seed işlemi başarısız oldu:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });