import { useEffect, useRef, useState } from "react";
import type { Feature, Region } from "../types";
import { createMap, firstLabelLayer, maplibregl } from "./mapKit";
import { epicenter } from "./UI";
import { bounds } from "../services/domain.mjs";

/** Epicentre viewer for the earthquakes section. */
export default function QuakeMap({
  quakes,
  region,
  theme,
  zone,
}: {
  quakes: Feature[];
  region: Region;
  theme: string;
  zone: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [styleRev, setStyleRev] = useState(0);
  useEffect(() => {
    const b = bounds[region];
    const map = createMap(el.current!, theme, {
      bounds: [b.minlongitude, b.minlatitude, b.maxlongitude, b.maxlatitude],
      fitBoundsOptions: { padding: 10 },
    });
    mapRef.current = map;
    map.on("style.load", () => setStyleRev((v) => v + 1));
    map.on("click", "quakes", (e) => {
      const f = e.features?.[0];
      if (!f || f.geometry.type !== "Point") return;
      const p = f.properties as any;
      const box = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = `M ${Number(p.mag).toFixed(1)} · ${p.place}`;
      const detail = document.createElement("p");
      detail.textContent = `${new Date(p.time).toLocaleString("es-PR", { timeZone: zone, dateStyle: "medium", timeStyle: "short" })} · ${Number(p.depth).toFixed(1)} km de profundidad`;
      box.append(title, detail);
      new maplibregl.Popup({ offset: 12, maxWidth: "260px" })
        .setLngLat(f.geometry.coordinates as [number, number])
        .setDOMContent(box)
        .addTo(map);
    });
    map.on("mouseenter", "quakes", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "quakes", () => {
      map.getCanvas().style.cursor = "";
    });
    return () => {
      mapRef.current = null;
      setStyleRev(0);
      map.remove();
    };
  }, [theme, region, zone]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleRev) return;
    const data = {
      type: "FeatureCollection" as const,
      features: quakes
        .filter((q) => q.geometry?.coordinates)
        .map((q) => ({
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: q.geometry.coordinates.slice(0, 2),
          },
          properties: {
            mag: q.properties.mag,
            place: epicenter(q.properties.place),
            time: q.properties.time,
            depth: q.geometry.coordinates[2],
          },
        })),
    };
    const source = map.getSource("quakes") as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(data);
      return;
    }
    const color: any = [
      "step",
      ["get", "mag"],
      "#a78bfa",
      3,
      "#fbbf24",
      4.5,
      "#fb7185",
    ];
    const radius = (k: number): any => [
      "interpolate",
      ["linear"],
      ["get", "mag"],
      0,
      3 * k,
      3,
      6 * k,
      5,
      13 * k,
      7,
      24 * k,
    ];
    const before = firstLabelLayer(map);
    map.addSource("quakes", { type: "geojson", data });
    map.addLayer(
      {
        id: "quakes-glow",
        type: "circle",
        source: "quakes",
        paint: {
          "circle-radius": radius(2.4),
          "circle-color": color,
          "circle-blur": 1,
          "circle-opacity": 0.45,
        },
      },
      before,
    );
    map.addLayer(
      {
        id: "quakes",
        type: "circle",
        source: "quakes",
        paint: {
          "circle-radius": radius(1),
          "circle-color": color,
          "circle-opacity": 0.85,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
          "circle-stroke-opacity": 0.75,
        },
      },
      before,
    );
  }, [styleRev, quakes]);
  return (
    <div className="map-wrap quake-map">
      <div ref={el} className="map" />
    </div>
  );
}
