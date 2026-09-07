import {
  registerHeadToHeadFeatures,
} from "@/modules/head-to-head-engine/feature-definitions";

import {
  registerShotThreatFeatures,
} from "@/modules/shot-threat-engine/feature-definitions";

import {
  registerSquadStrengthFeatures,
} from "@/modules/squad-strength-engine/feature-definitions";

import {
  registerTeamFormFeatures,
} from "@/modules/statistics-engine/feature-definitions";

import {
  clearFeatureRegistry,
  getRegisteredFeatures,
} from "./registry";

import type {
  FeatureRegistryDefinition,
} from "./types";

export function registerAllFeatures():
  FeatureRegistryDefinition[] {
  clearFeatureRegistry();

  registerTeamFormFeatures();

  registerHeadToHeadFeatures();

  registerSquadStrengthFeatures();

  registerShotThreatFeatures();

  return getRegisteredFeatures();
}