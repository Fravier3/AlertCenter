import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, LocateFixed, Maximize2, RefreshCw } from "lucide-react";
import type { Place, Region } from "../types";
import { createMap, firstLabelLayer, maplibregl, regionBox } from "./mapKit";
import { useRadar } from "./useRadar";
import { Jelly } from "./UI";
import { radarTiles, coverageTiles } from "../services/radar.mjs";
import { zones } from "../services/domain.mjs";
import { watchDeviceLocation } from "../services/geolocation.mjs";

const FRAME_MS = 200;
/** Extra ticks spent on the newest image before the loop restarts. */
const HOLD_TICKS = 6;
/** Radar tiles are only requested inside these boxes. */
const radarBox: Record<Region, [number, number, number, number]> = {
  pr: [-69, 17, -64, 20],
  co: [-76, 3, -72, 7],
};
const legend = [
  ["Llovizna", "#00a3e0"],
  ["Ligera", "#005588"],
  ["Moderada", "#ffee00"],
  ["Fuerte", "#ffaa00"],
  ["Intensa", "#c10000"],
  ["Extrema", "#ff77ff"],
];

/** Rain radar viewer: observed frames only, always looping. */
export default function MonitorMap({
  place,
  region,
  theme,
  preview = false,
  onOpen,
  onForecast,
  locationRequested = false,
  onLocationConsumed,
}: {
  place: Place;
  region: Region;
  theme: string;
  preview?: boolean;
  onOpen: () => void;
  onForecast: () => void;
  locationRequested?: boolean;
  onLocationConsumed: () => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [styleRev, setStyleRev] = useState(0);
  const radar = useRadar(place);
  const frames = radar.result?.data.frames ?? [];
  const framesKey = frames.map((f) => f.path).join("|");
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(0);
  const [tileError, setTileError] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [locationAttempt, setLocationAttempt] = useState(0);
  const [trackingStatus, setTrackingStatus] = useState("");
  const [center, setCenter] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const map = createMap(el.current!, theme, {
      bounds: regionBox[region],
      fitBoundsOptions: { padding: 24 },
      cooperativeGestures: preview,
    });
    mapRef.current = map;
    map.on("style.load", () => setStyleRev((v) => v + 1));
    map.on("error", (e: any) => {
      if (String(e?.sourceId ?? "").startsWith("rv-")) setTileError(true);
    });
    return () => {
      mapRef.current = null;
      setStyleRev(0);
      map.remove();
    };
  }, [theme, preview]);

  // Frame the region; a newly selected place in the same region is centred.
  const framed = useRef({ region, center, place: place.id });
  useEffect(() => {
    const map = mapRef.current;
    const last = framed.current;
    if (!map) return;
    if (last.region !== region || last.center !== center)
      map.fitBounds(regionBox[region], { padding: 24, duration: 900 });
    else if (last.place !== place.id)
      map.flyTo({ center: [place.lon, place.lat], zoom: 9, duration: 1100 });
    framed.current = { region, center, place: place.id };
  }, [region, center, place.id]);

  // Radar layers and the endless loop.
  useEffect(() => {
    const map = mapRef.current;
    const data = radar.result?.data;
    if (!map || !styleRev || !data) return;
    const before = firstLabelLayer(map);
    const ids: string[] = [];
    const add = (id: string, tiles: string, opacity: number) => {
      map.addSource(id, {
        type: "raster",
        tiles: [tiles],
        tileSize: 256,
        maxzoom: 7,
        bounds: radarBox[region],
        attribution:
          id === "rv-coverage"
            ? '<a href="https://www.rainviewer.com/" target="_blank" rel="noreferrer">Weather data by RainViewer</a>'
            : undefined,
      });
      map.addLayer(
        {
          id,
          type: "raster",
          source: id,
          paint: {
            "raster-opacity": opacity,
            "raster-opacity-transition": { duration: 0, delay: 0 },
            "raster-fade-duration": 0,
          },
        },
        before,
      );
      ids.push(id);
    };
    add("rv-coverage", coverageTiles(data.host), 0.32);
    const frameIds = data.frames.map((f) => "rv-" + f.time);
    data.frames.forEach((f, i) => add(frameIds[i], radarTiles(data.host, f), 0));
    const loaded = (id: string) => !!map.getSource(id) && map.isSourceLoaded(id);
    let current = data.frames.length - 1;
    let hold = 0;
    const show = (next: number) => {
      map.setPaintProperty(frameIds[current], "raster-opacity", 0);
      map.setPaintProperty(frameIds[next], "raster-opacity", 0.82);
      current = next;
      setIndex(next);
    };
    show(current);
    setTileError(false);
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setReady(frameIds.filter(loaded).length);
      setNow(Date.now());
      if (current === frameIds.length - 1 && hold < HOLD_TICKS) {
        hold++;
        return;
      }
      const next = (current + 1) % frameIds.length;
      // Wait for the next image instead of flashing an empty frame.
      if (!loaded(frameIds[next])) return;
      hold = 0;
      show(next);
    }, FRAME_MS);
    return () => {
      clearInterval(timer);
      if (mapRef.current !== map) return;
      for (const id of ids) {
        if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(id)) map.removeSource(id);
      }
    };
  }, [styleRev, framesKey, region]);

  // Real device position, only while the user asks for it.
  useEffect(() => {
    setTracking(false);
    setTrackingStatus("");
  }, [region]);
  useEffect(() => {
    if (locationRequested) {
      setTracking(true);
      setLocationAttempt((v) => v + 1);
      onLocationConsumed();
    }
  }, [locationRequested]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tracking) return;
    const pin = document.createElement("div");
    pin.className = "you-pin";
    pin.innerHTML = "<b>TÚ</b><i></i>";
    pin.title = "Tu ubicación GPS real";
    const marker = new maplibregl.Marker({ element: pin, anchor: "bottom" });
    let first = true;
    const stop = watchDeviceLocation(
      navigator.geolocation,
      document,
      (p: { lat: number; lon: number }) => {
        marker.setLngLat([p.lon, p.lat]).addTo(map);
        if (first) map.flyTo({ center: [p.lon, p.lat], zoom: 10 });
        else map.easeTo({ center: [p.lon, p.lat] });
        first = false;
      },
      setTrackingStatus,
    );
    return () => {
      stop();
      marker.remove();
    };
  }, [tracking, locationAttempt, theme, preview]);

  const frame = frames[index];
  const minutes = frame
    ? Math.max(0, Math.round((now - frame.time * 1000) / 60000))
    : 0;
  const preparing = frames.length > 0 && ready < frames.length;
  return (
    <section className={"map-card" + (preview ? " map-preview" : "")}>
      <div className="map-toolbar">
        <div>
          <span className="eyebrow">
            <span className="live-dot" />
            RADAR DE LLUVIA · EN VIVO
          </span>
          <h2>Mapa de monitoreo</h2>
        </div>
        <div className="map-actions">
          {preview ? (
            <Jelly onClick={onOpen}>
              Abrir radar <ArrowUpRight size={16} />
            </Jelly>
          ) : (
            <>
              <Jelly
                aria-pressed={tracking}
                onClick={() => {
                  setTrackingStatus("");
                  setTracking(!tracking);
                }}
              >
                <LocateFixed size={16} />
                {tracking ? "Ocultar mi ubicación" : "Mi ubicación"}
              </Jelly>
              <Jelly
                onClick={() => {
                  setTracking(false);
                  setCenter((x) => x + 1);
                }}
              >
                <Maximize2 size={16} /> Centrar
              </Jelly>
              <Jelly
                className="icon-button"
                aria-label="Volver a consultar el radar"
                onClick={radar.retry}
              >
                <RefreshCw size={16} className={radar.loading ? "spin" : ""} />
              </Jelly>
            </>
          )}
        </div>
      </div>
      <div className="map-wrap">
        <div ref={el} className="map" />
        <div className="map-chip" role="status">
          {radar.error ? (
            <span className="amber">{radar.error}</span>
          ) : !frames.length ? (
            "Consultando radar…"
          ) : preparing ? (
            `Cargando imágenes ${ready}/${frames.length}`
          ) : (
            <>
              <span className="live-dot" />
              {region === "pr" ? "Puerto Rico" : "Bogotá y Cundinamarca"}
            </>
          )}
        </div>
        {frame && (
          <div className="radar-hud">
            <div className="radar-hud-time">
              <strong>
                {new Date(frame.time * 1000).toLocaleTimeString("es-PR", {
                  timeZone: zones[region],
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </strong>
              <span>
                {index === frames.length - 1 ? "Más reciente · " : ""}hace{" "}
                {minutes} min
              </span>
            </div>
            <div className="radar-ticks" aria-hidden="true">
              {frames.map((f, i) => (
                <i
                  key={f.path}
                  className={i === index ? "on" : i < index ? "past" : ""}
                />
              ))}
            </div>
            <div className="radar-scale" aria-label="Intensidad de la lluvia">
              <span>Ligera</span>
              <i
                style={{
                  background: `linear-gradient(90deg, ${legend.map((l) => l[1]).join(",")})`,
                }}
              />
              <span>Extrema</span>
            </div>
          </div>
        )}
      </div>
      {!preview && (
        <div className="map-notes">
          {radar.coverage === "no" && (
            <p className="note-warning">
              El proveedor indica que {place.name} está fuera de la cobertura
              del radar. Un mapa vacío aquí no significa que no esté lloviendo.
            </p>
          )}
          {tileError && (
            <p className="note-warning" role="alert">
              Algunas imágenes no se cargaron. No interpretes las zonas vacías
              como ausencia de lluvia.
            </p>
          )}
          {radar.result?.cached && (
            <p className="note-warning">
              Secuencia guardada de una consulta anterior; las imágenes
              necesitan conexión.
            </p>
          )}
          {(tracking || trackingStatus) && (
            <p role="status">
              {trackingStatus ||
                "Tu posición se oculta al detener el seguimiento."}
            </p>
          )}
          <div className="radar-legend">
            {legend.map(([name, color]) => (
              <span key={name}>
                <i style={{ background: color }} />
                {name}
              </span>
            ))}
          </div>
          <p>
            Lluvia observada de las últimas dos horas, en repetición continua.
            Las zonas sombreadas quedan fuera de la cobertura del radar. No es
            un pronóstico ni una alerta oficial.{" "}
            <a href="https://www.rainviewer.com/" target="_blank" rel="noreferrer">
              Datos de RainViewer ↗
            </a>
          </p>
          <div className="radar-future">
            <div>
              <strong>¿Dónde va a llover?</strong>
              <p>
                El radar solo muestra lo que ya ocurrió. Para las próximas horas
                consulta el pronóstico de tu municipio.
              </p>
            </div>
            <Jelly className="primary" onClick={onForecast}>
              Ver pronóstico
            </Jelly>
          </div>
          <details>
            <summary>¿No aparece tu ubicación?</summary>
            <p>
              El marcador TÚ aparece solo al recibir coordenadas del
              dispositivo; el municipio del selector corresponde al clima, no a
              tu GPS. En iPhone: Ajustes → Privacidad y seguridad →
              Localización, y permite el acceso a Safari o a esta app. Mantén la
              app visible y prueba cerca de una ventana.
            </p>
            <Jelly
              onClick={() => {
                setTracking(true);
                setLocationAttempt((v) => v + 1);
              }}
            >
              Reintentar ubicación
            </Jelly>
          </details>
        </div>
      )}
    </section>
  );
}
