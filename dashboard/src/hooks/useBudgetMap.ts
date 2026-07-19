import { useState, useEffect } from 'react';

export interface RegionBudget {
  region_id: string;
  region_name: string;
  region_short: string;
  total_php: number;
  ps_php: number;
  mooe_php: number;
  co_php: number;
  fe_php: number;
  line_items: number;
  department_count: number;
  agency_count: number;
  rank: number;
  pct_of_national: number;
}

export interface GeoFeature {
  type: 'Feature';
  properties: {
    region_id: string;
    region_name: string;
    region_short: string;
  };
  geometry: GeoJSON.Geometry;
}

export interface GeoData {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

interface MapData {
  geojson: GeoData | null;
  regions: RegionBudget[];
  topRegion: RegionBudget | null;
  nationalTotal: number;
  loading: boolean;
}

export function useBudgetMap(query: <T>(sql: string) => Promise<T[]>): MapData {
  const [state, setState] = useState<MapData>({
    geojson: null,
    regions: [],
    topRegion: null,
    nationalTotal: 0,
    loading: true,
  });

  useEffect(() => {
    async function load() {
      // Load GeoJSON
      const geoRes = await fetch('/data/regions.geojson');
      const geojson: GeoData = await geoRes.json();

      // Load region budget data
      const rows = await query<{
        region_id: string;
        total_php: number;
        ps_php: number;
        mooe_php: number;
        co_php: number;
        fe_php: number;
        line_items: number;
        department_count: number;
        agency_count: number;
      }>(`
        SELECT region_id, total_php, ps_php, mooe_php, co_php, fe_php,
               line_items, department_count, agency_count
        FROM 'agg_region.parquet'
        ORDER BY total_php DESC
      `);

      const nationalTotal = rows.reduce((sum, r) => sum + Number(r.total_php), 0);

      // Build region name lookup from geojson
      const nameMap = new Map<string, { name: string; short: string }>();
      for (const feat of geojson.features) {
        nameMap.set(feat.properties.region_id, {
          name: feat.properties.region_name,
          short: feat.properties.region_short,
        });
      }

      // Region 18 won't be in our geojson (NIR is defunct), handle gracefully
      const REGION_NAMES: Record<string, { name: string; short: string }> = {
        '01': { name: 'Ilocos Region', short: 'Region I' },
        '02': { name: 'Cagayan Valley', short: 'Region II' },
        '03': { name: 'Central Luzon', short: 'Region III' },
        '04': { name: 'CALABARZON', short: 'Region IV-A' },
        '05': { name: 'Bicol Region', short: 'Region V' },
        '06': { name: 'Western Visayas', short: 'Region VI' },
        '07': { name: 'Central Visayas', short: 'Region VII' },
        '08': { name: 'Eastern Visayas', short: 'Region VIII' },
        '09': { name: 'Zamboanga Peninsula', short: 'Region IX' },
        '10': { name: 'Northern Mindanao', short: 'Region X' },
        '11': { name: 'Davao Region', short: 'Region XI' },
        '12': { name: 'SOCCSKSARGEN', short: 'Region XII' },
        '13': { name: 'National Capital Region', short: 'NCR' },
        '14': { name: 'Cordillera Admin. Region', short: 'CAR' },
        '16': { name: 'Caraga', short: 'Region XVI' },
        '17': { name: 'MIMAROPA', short: 'Region IV-B' },
        '18': { name: 'Negros Island Region', short: 'NIR' },
        '19': { name: 'Bangsamoro (BARMM)', short: 'BARMM' },
      };

      const regions: RegionBudget[] = rows.map((r, i) => {
        const names = nameMap.get(r.region_id) || REGION_NAMES[r.region_id] || { name: `Region ${r.region_id}`, short: `Reg ${r.region_id}` };
        return {
          region_id: r.region_id,
          region_name: names.name,
          region_short: names.short,
          total_php: Number(r.total_php),
          ps_php: Number(r.ps_php),
          mooe_php: Number(r.mooe_php),
          co_php: Number(r.co_php),
          fe_php: Number(r.fe_php),
          line_items: Number(r.line_items),
          department_count: Number(r.department_count),
          agency_count: Number(r.agency_count),
          rank: i + 1,
          pct_of_national: (Number(r.total_php) / nationalTotal) * 100,
        };
      });

      setState({
        geojson,
        regions,
        topRegion: regions[0] || null,
        nationalTotal,
        loading: false,
      });
    }

    load();
  }, [query]);

  return state;
}
