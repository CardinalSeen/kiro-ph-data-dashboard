import { useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import type { Layer, LeafletMouseEvent } from 'leaflet';
import type { GeoData, RegionBudget } from '../hooks/useBudgetMap';
import 'leaflet/dist/leaflet.css';

interface Props {
  geojson: GeoData;
  regions: RegionBudget[];
  nationalTotal: number;
  onRegionClick?: (regionId: string) => void;
}

// Quantile-based color scale that handles NCR outlier
function buildColorScale(regions: RegionBudget[]) {
  // Separate NCR (massive outlier) from other regions
  const nonNCR = regions
    .filter((r) => r.region_id !== '13')
    .sort((a, b) => a.total_php - b.total_php);

  if (nonNCR.length === 0) return () => '#deebf7';

  // Quantile breaks (5 bins for non-NCR regions)
  const breaks = [0.2, 0.4, 0.6, 0.8].map(
    (q) => nonNCR[Math.floor(q * (nonNCR.length - 1))].total_php
  );

  const ncrTotal = regions.find((r) => r.region_id === '13')?.total_php ?? 0;

  return (value: number) => {
    if (value >= ncrTotal * 0.9) return '#08306b'; // NCR: darkest blue
    if (value >= breaks[3]) return '#2171b5';
    if (value >= breaks[2]) return '#4292c6';
    if (value >= breaks[1]) return '#6baed6';
    if (value >= breaks[0]) return '#9ecae1';
    return '#deebf7';
  };
}

const formatPHP = (val: number) => {
  if (val >= 1e12) return `₱${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9) return `₱${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `₱${(val / 1e6).toFixed(0)}M`;
  return `₱${val.toLocaleString()}`;
};

export function RegionMap({ geojson, regions, onRegionClick }: Props) {
  const colorScale = useMemo(() => buildColorScale(regions), [regions]);

  const budgetMap = useMemo(() => {
    const map = new Map<string, RegionBudget>();
    regions.forEach((r) => map.set(r.region_id, r));
    return map;
  }, [regions]);

  const style = useCallback(
    (feature: GeoJSON.Feature | undefined) => {
      if (!feature) return {};
      const regionId = (feature.properties as { region_id: string }).region_id;
      const budget = budgetMap.get(regionId);
      const fillColor = budget ? colorScale(budget.total_php) : '#f0f0f0';

      return {
        fillColor,
        weight: 1.5,
        opacity: 1,
        color: '#ffffff',
        fillOpacity: 0.85,
      };
    },
    [budgetMap, colorScale]
  );

  const onEachFeature = useCallback(
    (feature: GeoJSON.Feature, layer: Layer) => {
      const regionId = (feature.properties as { region_id: string }).region_id;
      const budget = budgetMap.get(regionId);
      const props = feature.properties as { region_name: string; region_short: string };

      if (budget) {
        const tooltipContent = `
          <div class="map-tooltip">
            <strong>${props.region_name} (${props.region_short})</strong>
            <div class="tooltip-row">
              <span>Total Budget:</span>
              <span class="tooltip-val">${formatPHP(budget.total_php)}</span>
            </div>
            <div class="tooltip-row">
              <span>Rank:</span>
              <span class="tooltip-val">${budget.rank} of ${regions.length}</span>
            </div>
            <div class="tooltip-row">
              <span>% of National:</span>
              <span class="tooltip-val">${budget.pct_of_national.toFixed(1)}%</span>
            </div>
            <hr/>
            <div class="tooltip-row"><span>PS:</span><span>${formatPHP(budget.ps_php)} (${((budget.ps_php / budget.total_php) * 100).toFixed(0)}%)</span></div>
            <div class="tooltip-row"><span>MOOE:</span><span>${formatPHP(budget.mooe_php)} (${((budget.mooe_php / budget.total_php) * 100).toFixed(0)}%)</span></div>
            <div class="tooltip-row"><span>CO:</span><span>${formatPHP(budget.co_php)} (${((budget.co_php / budget.total_php) * 100).toFixed(0)}%)</span></div>
            <div class="tooltip-sub">Depts: ${budget.department_count} | Agencies: ${budget.agency_count}</div>
          </div>
        `;
        layer.bindTooltip(tooltipContent, { sticky: true, direction: 'top', className: 'region-tooltip' });
      }

      layer.on({
        mouseover: (e: LeafletMouseEvent) => {
          const target = e.target;
          target.setStyle({ weight: 3, color: '#333', fillOpacity: 0.95 });
          target.bringToFront();
        },
        mouseout: (e: LeafletMouseEvent) => {
          const target = e.target;
          target.setStyle({ weight: 1.5, color: '#ffffff', fillOpacity: 0.85 });
        },
        click: () => {
          if (onRegionClick) onRegionClick(regionId);
        },
      });
    },
    [budgetMap, regions.length, onRegionClick]
  );

  // Color legend breaks
  const legendItems = useMemo(() => {
    const nonNCR = regions.filter((r) => r.region_id !== '13').sort((a, b) => a.total_php - b.total_php);
    if (nonNCR.length === 0) return [];
    const breaks = [0, 0.2, 0.4, 0.6, 0.8].map(
      (q) => nonNCR[Math.min(Math.floor(q * (nonNCR.length - 1)), nonNCR.length - 1)].total_php
    );
    const colors = ['#deebf7', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08306b'];
    const labels = [
      `< ${formatPHP(breaks[1])}`,
      `${formatPHP(breaks[1])} - ${formatPHP(breaks[2])}`,
      `${formatPHP(breaks[2])} - ${formatPHP(breaks[3])}`,
      `${formatPHP(breaks[3])} - ${formatPHP(breaks[4])}`,
      `> ${formatPHP(breaks[4])}`,
      'NCR (outlier)',
    ];
    return colors.map((color, i) => ({ color, label: labels[i] }));
  }, [regions]);

  return (
    <div className="map-container">
      <div className="map-header">
        <h3>🗺️ Budget Allocation by Region</h3>
        <span className="map-note">
          Reflects allocation by operating unit. NCR shown on separate scale.
        </span>
      </div>
      <div className="map-wrapper">
        <MapContainer
          center={[12.5, 122.0]}
          zoom={5.5}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%', borderRadius: '8px' }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
          />
          <GeoJSON
            data={geojson as GeoJSON.FeatureCollection}
            style={style}
            onEachFeature={onEachFeature}
          />
        </MapContainer>
      </div>
      <div className="map-legend">
        {legendItems.map((item, i) => (
          <div key={i} className="legend-item">
            <span className="legend-swatch" style={{ background: item.color }} />
            <span className="legend-label">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
