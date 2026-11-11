import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Region } from "../types";

/** [west, south, east, north] framing of each region. */
export const regionBox: Record<Region, [number, number, number, number]> = {
  pr: [-67.55, 17.65, -65.15, 18.75],
  co: [-75.3, 3.6, -73.0, 6.0],
};

/** Raster basemap used only if the vector style cannot be loaded. */
const fallbackStyle = (theme: string): maplibregl.StyleSpecification => ({
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: ["a", "b", "c", "d"].map(
        (s) =>
          `https://${s}.basemaps.cartocdn.com/${theme === "dark" ? "dark_all" : "rastertiles/voyager"}/{z}/{x}/{y}@2x.png`,
      ),
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [{ id: "carto", type: "raster", source: "carto" }],
});

/**
 * Vector basemap (OpenFreeMap, OpenStreetMap data, no key). Callers add their
 * own layers on every "style.load", which also fires after the fallback swap.
 */
export function createMap(
  container: HTMLElement,
  theme: string,
  options: Partial<maplibregl.MapOptions> = {},
) {
  const map = new maplibregl.Map({
    container,
    style: `https://tiles.openfreemap.org/styles/${theme === "dark" ? "fiord" : "positron"}`,
    attributionControl: { compact: true },
    minZoom: 2,
    maxZoom: 13,
    dragRotate: false,
    pitchWithRotate: false,
    locale: {
      "NavigationControl.ZoomIn": "Acercar",
      "NavigationControl.ZoomOut": "Alejar",
      "AttributionControl.ToggleAttribution": "Mostrar atribución",
    },
    ...options,
  });
  map.touchZoomRotate.disableRotation();
  let styled = false;
  let fellBack = false;
  map.on("style.load", () => {
    styled = true;
  });
  map.on("error", () => {
    if (!styled && !fellBack) {
      fellBack = true;
      map.setStyle(fallbackStyle(theme));
    }
  });
  map.addControl(
    new maplibregl.NavigationControl({ showCompass: false }),
    "top-right",
  );
  return map;
}

/** Overlays go under the place names so labels stay readable. */
export const firstLabelLayer = (map: maplibregl.Map) =>
  map.getStyle().layers?.find((l) => l.type === "symbol")?.id;

export { maplibregl };
