import districtWardsRaw from '../data/district-wards.json';

type WardSource = number | string[];
type DistrictUlbConfig = Record<string, WardSource>;
type DistrictConfig = Record<string, DistrictUlbConfig>;

type DistrictUlbWards = Record<string, string[]>;
type DistrictUlbMap = Record<string, DistrictUlbWards>;

const districtConfig = districtWardsRaw as DistrictConfig;

const normalized = Object.fromEntries(
  Object.entries(districtConfig).map(([district, ulbs]) => {
    const ulbMap = Object.fromEntries(
      Object.entries(ulbs).map(([ulbName, wardSource]) => {
        if (Array.isArray(wardSource)) {
          return [ulbName, wardSource];
        }
        return [
          ulbName,
          Array.from({ length: wardSource }, (_, index) => `Ward ${index + 1}`),
        ];
      }),
    ) as DistrictUlbWards;

    return [district, ulbMap];
  }),
) as DistrictUlbMap;

export const DISTRICT_ULB_WARDS: DistrictUlbMap = normalized;

export const DISTRICT_OPTIONS = Object.keys(DISTRICT_ULB_WARDS);

export function ulbsForDistrict(district: string) {
  return Object.keys(DISTRICT_ULB_WARDS[district] ?? {});
}

export function wardsForDistrictUlb(district: string, ulb: string) {
  return DISTRICT_ULB_WARDS[district]?.[ulb] ?? [];
}

export function toStoredWardValue(district: string, ulb: string, wardLabel: string) {
  if (!district || !ulb || !wardLabel) {
    return wardLabel;
  }
  return `${district}::${ulb}::${wardLabel}`;
}

export function parseStoredWardValue(storedWard: string) {
  const parts = storedWard.split('::');
  if (parts.length >= 3) {
    const [district, ulb, ...wardRest] = parts;
    return {
      district,
      ulb,
      wardLabel: wardRest.join('::'),
    };
  }

  if (parts.length === 2) {
    return {
      district: parts[0],
      ulb: 'Unknown',
      wardLabel: parts[1],
    };
  }

  return {
    district: 'Unknown',
    ulb: 'Unknown',
    wardLabel: storedWard,
  };
}

export function districtForWard(wardNumber: string) {
  return parseStoredWardValue(wardNumber).district;
}

export function ulbForWard(wardNumber: string) {
  return parseStoredWardValue(wardNumber).ulb;
}

export function wardLabelFromStored(wardNumber: string) {
  return parseStoredWardValue(wardNumber).wardLabel;
}
