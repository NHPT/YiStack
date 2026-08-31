import type { Plan, PlanFeatureList } from '@/lib/api';

export function getPlanFeatureList(plan: Pick<Plan, 'features'>): PlanFeatureList {
  const rawFeatures: unknown = plan.features;
  if (Array.isArray(rawFeatures) === false) {
    return [];
  }

  const features: PlanFeatureList = [];
  for (const feature of rawFeatures) {
    if (typeof feature !== 'string') {
      continue;
    }

    const normalizedFeature = feature.trim();
    if (normalizedFeature.length > 0) {
      features.push(normalizedFeature);
    }
  }

  return features;
}

export function getPlanFeatureSummary(plan: Pick<Plan, 'features'>): string {
  const features = getPlanFeatureList(plan);
  if (features.length === 0) {
    return '待确认';
  }

  return features.join('、');
}
