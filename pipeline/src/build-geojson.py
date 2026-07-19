"""
Simplify PH regions GeoJSON and map to PSGC region codes.
Reduces ~15MB to <300KB for fast Leaflet rendering.
"""
import json
import sys
import math

INPUT = "/tmp/ph_regions.geojson"
OUTPUT = "/Users/marcsandrino/kiro-ph-data-dashboard/dashboard/public/data/regions.geojson"

# Map from GeoJSON REGION property to our PSGC region_id codes
REGION_MAP = {
    "Ilocos Region (Region I)": {"id": "01", "name": "Ilocos Region", "short": "Region I"},
    "Cagayan Valley (Region II)": {"id": "02", "name": "Cagayan Valley", "short": "Region II"},
    "Central Luzon (Region III)": {"id": "03", "name": "Central Luzon", "short": "Region III"},
    "CALABARZON (Region IV-A)": {"id": "04", "name": "CALABARZON", "short": "Region IV-A"},
    "Bicol Region (Region V)": {"id": "05", "name": "Bicol Region", "short": "Region V"},
    "Western Visayas (Region VI)": {"id": "06", "name": "Western Visayas", "short": "Region VI"},
    "Central Visayas (Region VII)": {"id": "07", "name": "Central Visayas", "short": "Region VII"},
    "Eastern Visayas (Region VIII)": {"id": "08", "name": "Eastern Visayas", "short": "Region VIII"},
    "Zamboanga Peninsula (Region IX)": {"id": "09", "name": "Zamboanga Peninsula", "short": "Region IX"},
    "Northern Mindanao (Region X)": {"id": "10", "name": "Northern Mindanao", "short": "Region X"},
    "Davao Region (Region XI)": {"id": "11", "name": "Davao Region", "short": "Region XI"},
    "SOCCSKSARGEN (Region XII)": {"id": "12", "name": "SOCCSKSARGEN", "short": "Region XII"},
    "Metropolitan Manila": {"id": "13", "name": "National Capital Region", "short": "NCR"},
    "Cordillera Administrative Region (CAR)": {"id": "14", "name": "Cordillera Administrative Region", "short": "CAR"},
    "Caraga (Region XIII)": {"id": "16", "name": "Caraga", "short": "Region XVI"},
    "MIMAROPA (Region IV-B)": {"id": "17", "name": "MIMAROPA", "short": "Region IV-B"},
    "Autonomous Region of Muslim Mindanao (ARMM)": {"id": "19", "name": "Bangsamoro (BARMM)", "short": "BARMM"},
}


def douglas_peucker(points, epsilon):
    """Douglas-Peucker line simplification."""
    if len(points) <= 2:
        return points

    # Find point with max distance from line between first and last
    dmax = 0
    index = 0
    end = len(points) - 1

    for i in range(1, end):
        d = perpendicular_distance(points[i], points[0], points[end])
        if d > dmax:
            index = i
            dmax = d

    if dmax > epsilon:
        left = douglas_peucker(points[:index + 1], epsilon)
        right = douglas_peucker(points[index:], epsilon)
        return left[:-1] + right
    else:
        return [points[0], points[end]]


def perpendicular_distance(point, line_start, line_end):
    """Distance from point to line defined by two points."""
    x0, y0 = point[0], point[1]
    x1, y1 = line_start[0], line_start[1]
    x2, y2 = line_end[0], line_end[1]

    dx = x2 - x1
    dy = y2 - y1
    
    if dx == 0 and dy == 0:
        return math.sqrt((x0 - x1) ** 2 + (y0 - y1) ** 2)

    t = ((x0 - x1) * dx + (y0 - y1) * dy) / (dx * dx + dy * dy)
    t = max(0, min(1, t))

    proj_x = x1 + t * dx
    proj_y = y1 + t * dy

    return math.sqrt((x0 - proj_x) ** 2 + (y0 - proj_y) ** 2)


def simplify_ring(ring, epsilon=0.02):
    """Simplify a coordinate ring using Douglas-Peucker."""
    simplified = douglas_peucker(ring, epsilon)
    # Ensure ring is closed
    if simplified[0] != simplified[-1]:
        simplified.append(simplified[0])
    # Round coordinates to 2 decimal places
    return [[round(p[0], 2), round(p[1], 2)] for p in simplified]


def simplify_geometry(geometry, epsilon=0.02):
    """Reduce polygon complexity."""
    if geometry["type"] == "Polygon":
        new_rings = []
        for ring in geometry["coordinates"]:
            s = simplify_ring(ring, epsilon)
            if len(s) >= 4:
                new_rings.append(s)
        if not new_rings:
            return None
        return {"type": "Polygon", "coordinates": new_rings}

    elif geometry["type"] == "MultiPolygon":
        new_polys = []
        for polygon in geometry["coordinates"]:
            new_rings = []
            for ring in polygon:
                s = simplify_ring(ring, epsilon)
                if len(s) >= 4:
                    new_rings.append(s)
            if new_rings:
                new_polys.append(new_rings)
        if not new_polys:
            return None
        return {"type": "MultiPolygon", "coordinates": new_polys}

    return geometry


def main():
    with open(INPUT) as f:
        data = json.load(f)

    features = []
    total_vertices_before = 0
    total_vertices_after = 0

    for feat in data["features"]:
        region_label = feat["properties"]["REGION"]
        mapping = REGION_MAP.get(region_label)

        if not mapping:
            print(f"WARNING: Unmapped region: {region_label}", file=sys.stderr)
            continue

        # Count original vertices
        geom = feat["geometry"]
        if geom["type"] == "Polygon":
            total_vertices_before += sum(len(r) for r in geom["coordinates"])
        elif geom["type"] == "MultiPolygon":
            for poly in geom["coordinates"]:
                total_vertices_before += sum(len(r) for r in poly)

        simplified_geom = simplify_geometry(geom, epsilon=0.015)
        if simplified_geom is None:
            continue

        # Count simplified vertices
        if simplified_geom["type"] == "Polygon":
            total_vertices_after += sum(len(r) for r in simplified_geom["coordinates"])
        elif simplified_geom["type"] == "MultiPolygon":
            for poly in simplified_geom["coordinates"]:
                total_vertices_after += sum(len(r) for r in poly)

        features.append({
            "type": "Feature",
            "properties": {
                "region_id": mapping["id"],
                "region_name": mapping["name"],
                "region_short": mapping["short"],
            },
            "geometry": simplified_geom
        })

    output = {
        "type": "FeatureCollection",
        "features": sorted(features, key=lambda f: f["properties"]["region_id"])
    }

    with open(OUTPUT, "w") as f:
        json.dump(output, f, separators=(",", ":"))

    size = len(json.dumps(output, separators=(",", ":")))
    print(f"Regions mapped: {len(features)}")
    print(f"Vertices: {total_vertices_before:,} → {total_vertices_after:,} ({100*total_vertices_after/total_vertices_before:.1f}%)")
    print(f"Output size: {size / 1024:.0f} KB")
    print(f"Written to: {OUTPUT}")


if __name__ == "__main__":
    main()
