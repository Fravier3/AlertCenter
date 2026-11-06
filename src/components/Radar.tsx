import { useEffect, useState } from "react";
import { TileLayer } from "react-leaflet";
import { Pause, Play, RefreshCw } from "lucide-react";
import type { Place, Result, Region } from "../types";
import { cached } from "../services/api";
import {
  normalizeRadarManifest,
  radarTiles,
  coverageTiles,
  coveragePoint,
  radarFrameLabel,
} from "../services/radar.mjs";
import { zones } from "../services/domain.mjs";
type Manifest = ReturnType<typeof normalizeRadarManifest>;
export function useRadar(active: boolean, place: Place) {
  const [result, setResult] = useState<Result<Manifest> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tileError, setTileError] = useState(false);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [readyFrames, setReadyFrames] = useState<Set<string>>(() => new Set());
  const readyCount =
    result?.data.frames.filter((f) => readyFrames.has(place.region + f.path))
      .length ?? 0;
  const framesReady = !!result && readyCount === result.data.frames.length;
  const [attempt, setAttempt] = useState(0);
  const [coverage, setCoverage] = useState<"yes" | "no" | "unknown">("unknown");
  useEffect(() => {
    if (!active) {
      setPlaying(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError("");
    setTileError(false);
    cached<any>(
      "radar:manifest",
      "https://api.rainviewer.com/public/weather-maps.json",
      300000,
      (x) => {
        try {
          normalizeRadarManifest(x);
          return true;
        } catch {
          return false;
        }
      },
    )
      .then((r) => {
        if (alive) {
          const data = normalizeRadarManifest(r.data);
          setReadyFrames(old => new Set([...old].filter(key => data.frames.some(f => key.slice(2) === f.path))));
          setResult({ ...r, data });
          setIndex(0);
        }
      })
      .catch(() => {
        if (alive)
          setError(
            "No se pudo consultar el radar. Reintenta o usa el pronóstico horario en Clima.",
          );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine)
        setAttempt((x) => x + 1);
    }, 300000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [active, attempt]);
  useEffect(() => {
    if (!active || !result) return;
    let alive = true;
    setCoverage("unknown");
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timeout = setTimeout(() => {
      img.src = "";
      if (alive) setCoverage("unknown");
    }, 12000);
    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw Error();
        ctx.drawImage(img, 128, 128, 1, 1, 0, 0, 1, 1);
        const alpha = ctx.getImageData(0, 0, 1, 1).data[3];
        if (alive) setCoverage(alpha < 128 ? "yes" : "no");
      } catch {
        if (alive) setCoverage("unknown");
      }
    };
    img.onerror = () => {
      clearTimeout(timeout);
      if (alive) setCoverage("unknown");
    };
    img.src = coveragePoint(result.data.host, place.lat, place.lon);
    return () => {
      alive = false;
      clearTimeout(timeout);
      img.onload = null;
      img.onerror = null;
    };
  }, [active, result?.data.host, place.id]);
  useEffect(() => {
    if (!active || !playing || !result || !framesReady || tileError) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible")
        setIndex((i) => (i + 1) % result.data.frames.length);
      else setPlaying(false);
    }, 200);
    return () => clearInterval(id);
  }, [active, playing, result, framesReady, tileError]);
  useEffect(() => {
    setPlaying(active);
    setReadyFrames(new Set());
    setIndex(0);
    setTileError(false);
  }, [active, place.region]);
  return {
    result,
    readyCount,
    framesReady,
    markReady: (key: string) =>
      setReadyFrames((old) => (old.has(key) ? old : new Set([...old, key]))),
    markLoading: (key: string) =>
      setReadyFrames((old) => {
        if (!old.has(key)) return old;
        const next = new Set(old);
        next.delete(key);
        return next;
      }),
    loading,
    error,
    tileError,
    index,
    playing,
    coverage,
    frame: result?.data.frames[index],
    setIndex,
    setPlaying,
    fail: () => {
      setTileError(true);
      setPlaying(false);
    },
    retry: () => {
      setReadyFrames(new Set());
      setPlaying(true);
      setResult(null);
      setAttempt((x) => x + 1);
    },
  };
}
export type RadarState = ReturnType<typeof useRadar>;
const regionBounds: Record<Region, [[number, number], [number, number]]> = {
  pr: [
    [17, -69],
    [20, -64],
  ],
  co: [
    [3, -76],
    [7, -72],
  ],
};
export function RadarTiles({
  radar,
  region,
}: {
  radar: RadarState;
  region: Region;
}) {
  if (!radar.result || !radar.frame) return null;
  const props = {
    maxNativeZoom: 7,
    maxZoom: 19,
    noWrap: true,
    bounds: regionBounds[region],
    keepBuffer: 0,
    updateWhenIdle: true,
    updateWhenZooming: false,
  };
  return (
    <>
      <TileLayer
        key={"coverage:" + region}
        {...props}
        url={coverageTiles(radar.result.data.host)}
        opacity={0.45}
        zIndex={300}
        className="radar-coverage"
        eventHandlers={{ tileerror: radar.fail }}
      />
      {radar.result.data.frames.map((frame, i) => (
        <TileLayer
          {...props}
          key={region + frame.path}
          url={radarTiles(radar.result!.data.host, frame)}
          opacity={i === radar.index ? 0.78 : 0}
          zIndex={310}
          className="radar-echoes"
          attribution={
            i === 0
              ? '<a href="https://www.rainviewer.com/">Weather data by RainViewer</a>'
              : undefined
          }
          eventHandlers={{
            tileerror: radar.fail,
            loading: () => radar.markLoading(region + frame.path),
            load: () => radar.markReady(region + frame.path),
          }}
        />
      ))}
    </>
  );
}
export function RadarControls({
  radar,
  place,
  onForecast,
}: {
  radar: RadarState;
  place: Place;
  onForecast: () => void;
}) {
  return (
    <div className="radar-controls">
      <div className="radar-heading">
        <div>
          <span className="eyebrow">RADAR OBSERVADO · ÚLTIMAS 2 HORAS</span>
          <h3>Lluvia en movimiento</h3>
        </div>
        <button onClick={radar.retry} aria-label="Reintentar consulta de radar">
          <RefreshCw size={16} />
        </button>
      </div>
      {radar.loading && <p role="status">Consultando imágenes reales…</p>}
      {radar.result && !radar.loading && (
        <p className="source-caption" role="status">
          {!radar.framesReady
            ? `Preparando loop rápido · ${radar.readyCount}/${radar.result.data.frames.length} imágenes listas…`
            : radar.playing
              ? "Loop automático rápido · 200 ms por imagen."
              : "Animación en pausa. Pulsa reproducir para continuar."}
        </p>
      )}
      {radar.error && (
        <p role="alert" className="amber">
          {radar.error}
        </p>
      )}
      {radar.frame && radar.result && (
        <>
          <div className="radar-timeline">
            <button
              aria-label={
                radar.playing
                  ? "Pausar animación de radar"
                  : "Reproducir animación de radar"
              }
              disabled={radar.tileError || radar.loading}
              onClick={() => radar.setPlaying((v) => !v)}
            >
              {radar.playing ? <Pause size={17} /> : <Play size={17} />}
            </button>
            <label>
              <span>
                {radarFrameLabel(radar.frame.time, zones[place.region])}
              </span>
              <input
                aria-label="Momento de la imagen de radar"
                type="range"
                min="0"
                max={radar.result.data.frames.length - 1}
                step="1"
                value={radar.index}
                onChange={(e) => {
                  radar.setPlaying(false);
                  radar.setIndex(Number(e.target.value));
                }}
              />
            </label>
          </div>
          {radar.result.cached && (
            <p className="amber">
              Secuencia guardada · consulta{" "}
              {new Date(radar.result.at).toLocaleString("es-PR", {
                timeZone: zones[place.region],
              })}
              . Las imágenes necesitan conexión.
            </p>
          )}
          <p className={radar.coverage === "no" ? "coverage-warning" : ""}>
            {radar.coverage === "yes"
              ? `La máscara del proveedor indica cobertura en el punto seleccionado de ${place.name}.`
              : radar.coverage === "no"
                ? `La máscara del proveedor indica SIN COBERTURA en el punto seleccionado de ${place.name}. Un mapa vacío aquí no significa que no esté lloviendo.`
                : "Cobertura del punto sin confirmar. Un mapa sin ecos no garantiza ausencia de lluvia."}{" "}
            Las zonas sombreadas están fuera de cobertura según esa máscara.
          </p>
          <div className="radar-legend">
            <span>Reflectividad · dBZ</span>
            <div>
              {[
                [20, "#00a3e0"],
                [30, "#005588"],
                [35, "#ffee00"],
                [40, "#ffaa00"],
                [50, "#c10000"],
                [60, "#ff77ff"],
              ].map(([value, color]) => (
                <span key={value} style={{ borderTop: `6px solid ${color}` }}>
                  {value}
                </span>
              ))}
            </div>
          </div>
          <p className="source-caption">
            La hora corresponde a la generación del mosaico; cada radar puede
            tener retrasos. La máscara de cobertura se actualiza con poca
            frecuencia. Al ampliar, la imagen conserva la resolución original
            (zoom 7). No es una alerta oficial.
          </p>
        </>
      )}
      {radar.tileError && (
        <p className="amber" role="alert">
          No se pudieron cargar todas las imágenes o la cobertura. No
          interpretes las áreas vacías como ausencia de lluvia. Reintenta más
          tarde.
        </p>
      )}
      <div className="radar-future">
        <div>
          <strong>¿Dónde va a llover?</strong>
          <p>
            Esta fuente gratuita no ofrece radar futuro. Consulta el pronóstico
            por hora para tu ubicación; es un modelo, no una imagen futura de
            radar.
          </p>
        </div>
        <button onClick={onForecast}>Ver pronóstico</button>
      </div>
      <a href="https://www.rainviewer.com/" target="_blank" rel="noreferrer">
        Weather data by RainViewer ↗
      </a>
    </div>
  );
}
