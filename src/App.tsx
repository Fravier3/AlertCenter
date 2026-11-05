import WeatherSky from "./components/WeatherSky";
import ModelSignals from "./components/ModelSignals";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Bell,
  Check,
  ChevronRight,
  CloudRain,
  Compass,
  Droplets,
  Eye,
  Gauge,
  Heart,
  Home,
  LocateFixed,
  Map as MapIcon,
  Menu,
  Moon,
  Radio,
  RefreshCw,
  Settings as SettingsIcon,
  ShieldCheck,
  Sun,
  Sunrise,
  Sunset,
  Thermometer,
  Wind,
  WifiOff,
  X,
  Download,
  ExternalLink,
} from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import placesRaw from "./data/places.json";
import type {
  Place,
  Region,
  Weather,
  Air,
  Feature,
  Result,
  Settings,
} from "./types";
import * as api from "./services/api";
import {
  zones,
  temp,
  weatherLabel,
  modelTime,
  distance,
  aqiCategory,
  dailyQuakes,
  safeSettings,
} from "./services/domain.mjs";
import { WeatherIcon, Stamp, SourceLink, Empty } from "./components/UI";
const MonitorMap = lazy(() => import("./components/MonitorMap"));
const Chart = lazy(() => import("./components/Chart"));
const places = placesRaw as Place[];
const nav = [
  { id: "inicio", name: "Inicio", icon: Home },
  { id: "mapa", name: "Mapa", icon: MapIcon },
  { id: "alertas", name: "Alertas", icon: Bell },
  { id: "sismos", name: "Sismos", icon: Activity },
  { id: "clima", name: "Clima", icon: CloudRain },
  { id: "ajustes", name: "Ajustes", icon: SettingsIcon },
];
const severityNames: Record<string, string> = {
  Extreme: "Extrema",
  Severe: "Severa",
  Moderate: "Moderada",
  Minor: "Menor",
  Unknown: "No especificada",
};
function Panel({
  title,
  kicker,
  children,
  action,
}: {
  title: string;
  kicker?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          {kicker && <span className="eyebrow">{kicker}</span>}
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function useRemote<T>(
  key: string,
  load: () => Promise<Result<T> | null>,
  refresh: number,
) {
  const [result, setResult] = useState<Result<T> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setResult(null);
    setError("");
    setLoading(true);
    load()
      .then((r) => {
        if (alive) setResult(r);
      })
      .catch((e) => {
        if (alive)
          setError(
            e instanceof Error
              ? e.message
              : "No se pudo conectar con la fuente",
          );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [key, refresh]);
  return { result, error, loading };
}
export default function App() {
  const [settings, setSettings] = useState<Settings>(
    () => safeSettings(api.readStore("ac:settings:v1"), places) as Settings,
  );
  const [view, setView] = useState(() =>
    nav.some((n) => n.id === location.hash.slice(1))
      ? location.hash.slice(1)
      : "inicio",
  );
  const [refresh, setRefresh] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [days, setDays] = useState(7);
  const [eventCategory, setEventCategory] = useState("todos");
  const [eventSeverity, setEventSeverity] = useState("todos");
  const [eventDate, setEventDate] = useState("");
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [installHelp, setInstallHelp] = useState(false);
  const [now, setNow] = useState(Date.now());
  const region = settings.region;
  const unit = settings.units[region];
  const setUnit = (value: "c" | "f") => setSettings(s => ({...s, units: {...s.units, [s.region]: value}}));
  const place =
    places.find((p) => p.id === settings.placeId) ||
    places.find((p) => p.id === "72127")!;
  const zone = zones[region];
  const patch = (p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p }));
  const navigate = (v: string) => {
    setView(v);
    location.hash = v;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const setPlace = (p: Place) => {
    patch({ placeId: p.id, region: p.region });
    setQuery("");
  };
  const setRegion = (r: Region) => {
    const last = api.readStore("ac:last:" + r);
    const p =
      places.find((x) => x.id === last && x.region === r) ||
      places.find((x) => x.id === (r === "pr" ? "72127" : "11001"))!;
    setPlace(p);
  };
  const w = useRemote<Weather>(
    "weather:" + place.id,
    () => api.weather(place),
    refresh,
  );
  const a = useRemote<Air>("air:" + place.id, () => api.air(place), refresh);
  const q = useRemote<{ features: Feature[] }>(
    "quakes:" + region,
    () => api.earthquakes(region),
    refresh,
  );
  const al = useRemote<{ features: Feature[]; updated: string }>(
    "alerts:" + region,
    () => api.alerts(region),
    refresh,
  );
  const weather = w.result?.data;
  const air = a.result?.data;
  const current = weather?.current;
  const daily = weather?.daily;
  const hourIndex = weather
    ? Math.max(
        0,
        weather.hourly.time.findIndex(
          (t: string) => modelTime(t, weather.utc_offset_seconds) >= now,
        ) - 1,
      )
    : 0;
  const quakes = useMemo(
    () =>
      q.result?.data.features.filter(
        (f) =>
          f.properties.mag != null &&
          f.properties.mag >= settings.mag &&
          f.properties.time >= now - days * 86400000,
      ) || [],
    [q.result, settings.mag, days, now],
  );
  const officialAlerts = useMemo(
    () =>
      al.result?.data.features.filter(
        (f) => Date.parse(f.properties.expires) > now,
      ) || [],
    [al.result, now],
  );
  const shownAlerts = settings.showAlerts ? officialAlerts : [];
  const aq = aqiCategory(air?.current.us_aqi);
  const fmt = (t: number | string, full = true) =>
    new Date(t).toLocaleString("es-PR", {
      timeZone: zone,
      ...(full ? { month: "short", day: "numeric" } : {}),
      hour: "2-digit",
      minute: "2-digit",
    });
  const time = (t: string) => t?.split("T")[1]?.slice(0, 5) || "—";
  const t = (v: number) => temp(v, unit);
  const degree = unit === "c" ? "°C" : "°F";
  const next24 =
    weather?.hourly.time
      .slice(hourIndex, hourIndex + 24)
      .map((x: string, i: number) => ({
        label: time(x),
        value:
          weather.hourly.temperature_2m[hourIndex + i] == null
            ? null
            : Number(
                temp(
                  weather.hourly.temperature_2m[hourIndex + i],
                  unit,
                ),
              ),
        rain: weather.hourly.precipitation[hourIndex + i],
        prob: weather.hourly.precipitation_probability[hourIndex + i],
      })) || [];
  const [chartMode, setChartMode] = useState<"temp" | "rain">("temp");
  const {
    needRefresh: [needsUpdate],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (reg) {
        window.addEventListener("focus", () => reg.update());
        window.addEventListener("online", () => reg.update());
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") reg.update();
        });
      }
    },
  });
  useEffect(() => {
    api.writeStore("ac:settings:v1", settings);
    api.writeStore("ac:last:" + region, place.id);
    document.documentElement.dataset.theme = settings.theme;
  }, [settings, region, place.id]);
  useEffect(() => {
    const on = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) setRefresh((x) => x + 1);
    };
    const hash = () =>
      setView(
        nav.some((n) => n.id === location.hash.slice(1))
          ? location.hash.slice(1)
          : "inicio",
      );
    const before = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    window.addEventListener("hashchange", hash);
    window.addEventListener("beforeinstallprompt", before);
    const clock = setInterval(() => setNow(Date.now()), 60000);
    const reload = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine)
        setRefresh((x) => x + 1);
    }, 300000);
    return () => {
      clearInterval(clock);
      clearInterval(reload);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("beforeinstallprompt", before);
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(id);
  }, [notice]);
  const seen = useRef(new Set<string>());
  const baseline = useRef("");
  useEffect(() => {
    if (!q.result || (region === "pr" && !al.result)) return;
    const events = [
      ...quakes.map((f) => ({
        id: String(f.id),
        title: `Sismo M ${f.properties.mag}`,
        text: f.properties.place,
      })),
      ...shownAlerts.map((f) => ({
        id: String(f.id),
        title: f.properties.event,
        text: f.properties.headline,
      })),
    ];
    if (baseline.current !== region) {
      baseline.current = region;
      seen.current = new Set(events.map((e) => e.id));
      return;
    }
    events.forEach((e) => {
      if (!seen.current.has(e.id)) {
        seen.current.add(e.id);
        if (
          settings.notify &&
          document.visibilityState === "visible" &&
          "Notification" in window &&
          Notification.permission === "granted"
        )
          navigator.serviceWorker?.ready
            .then((reg) =>
              reg.showNotification(e.title, {
                body: e.text,
                icon: import.meta.env.BASE_URL + "icon-192.png",
                tag: e.id,
              }),
            )
            .catch(() => {});
      }
    });
  }, [q.result, al.result, region, settings.notify]);
  const locate = () => {
    if (!navigator.geolocation) {
      setNotice("Este navegador no dispone de geolocalización.");
      return;
    }
    setNotice("Buscando la ubicación más cercana…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = places
          .filter((x) => x.region === region)
          .sort(
            (a, b) =>
              distance(
                pos.coords.latitude,
                pos.coords.longitude,
                a.lat,
                a.lon,
              ) -
              distance(pos.coords.latitude, pos.coords.longitude, b.lat, b.lon),
          )[0];
        if (
          distance(pos.coords.latitude, pos.coords.longitude, p.lat, p.lon) >
          250
        ) {
          setNotice(
            "Tu ubicación está fuera de la región seleccionada. Selecciona un municipio.",
          );
          return;
        }
        setPlace(p);
        setNotice("Ubicación aproximada seleccionada: " + p.name);
      },
      () =>
        setNotice(
          "No se obtuvo tu ubicación. Puedes escoger el municipio manualmente.",
        ),
      { timeout: 12000, maximumAge: 300000, enableHighAccuracy: false },
    );
  };
  const toggleFavorite = () =>
    patch({
      favorites: settings.favorites.includes(place.id)
        ? settings.favorites.filter((id) => id !== place.id)
        : [...settings.favorites, place.id],
    });
  const install = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      setInstallPrompt(null);
    } else setInstallHelp(true);
  };
  const notify = async () => {
    if (!("Notification" in window) || !navigator.serviceWorker) {
      setNotice(
        "Notificaciones no disponibles aquí. En iPhone se requiere instalar la app y una versión compatible de iOS.",
      );
      return;
    }
    const permission = await Notification.requestPermission();
    patch({ notify: permission === "granted" });
    setNotice(
      permission === "granted"
        ? "Avisos activados mientras la aplicación permanezca abierta."
        : "No se activaron los avisos. Puedes seguir usando toda la aplicación.",
    );
  };
  const apiErrors = [
    ["Clima", w.error],
    ["Aire", a.error],
    ["Sismos", q.error],
    ["Alertas", al.error],
  ].filter((x) => x[1]);
  const stale = [w.result, a.result, q.result, al.result].some(
    (r) => r?.cached,
  );
  const loading = w.loading || a.loading || q.loading || al.loading;
  const eventList = [
    ...quakes.map((f) => ({
      id: String(f.id),
      cat: "sismos",
      title: `Sismo M ${f.properties.mag} · ${f.properties.place}`,
      at: f.properties.time,
      source: "USGS · registro sísmico",
      url: f.properties.url,
      severity: f.properties.mag >= 4 ? "destacados" : "otros",
    })),
    ...shownAlerts.map((f) => ({
      id: String(f.id),
      cat: "alertas",
      title: f.properties.headline || f.properties.event,
      at: Date.parse(f.properties.sent),
      source: "NWS · alerta oficial",
      url: f.properties["@id"] || f.properties.id,
      severity: ["Severe", "Extreme"].includes(f.properties.severity)
        ? "destacados"
        : "otros",
    })),
  ]
    .filter(
      (e) =>
        (eventCategory === "todos" || e.cat === eventCategory) &&
        (eventSeverity === "todos" || e.severity === eventSeverity) &&
        (!eventDate ||
          new Intl.DateTimeFormat("sv-SE", { timeZone: zone }).format(
            new Date(e.at),
          ) === eventDate),
    )
    .sort((a, b) => b.at - a.at);
  const forecast = (
    <Panel title="Los próximos 7 días" kicker="PLANIFICA TU SEMANA">
      <div className="forecast-list">
        {daily ? (
          daily.time.map((date: string, i: number) => (
            <div className="forecast-row" key={date}>
              <span>
                {i === 0
                  ? "Hoy"
                  : new Date(date + "T12:00:00").toLocaleDateString("es-PR", {
                      weekday: "short",
                      day: "numeric",
                    })}
              </span>
              <WeatherIcon code={daily.weather_code[i]} size={23} />
              <span className="forecast-desc">
                {weatherLabel(daily.weather_code[i])}
              </span>
              <span className="rain">
                <Droplets size={13} />
                {daily.precipitation_probability_max[i] ?? "—"}%
              </span>
              <strong>
                {t(daily.temperature_2m_max[i])}°{" "}
                <small>{t(daily.temperature_2m_min[i])}°</small>
              </strong>
            </div>
          ))
        ) : (
          <Empty
            text={
              w.loading ? "Cargando pronóstico…" : "Pronóstico no disponible."
            }
          />
        )}
      </div>
      <Stamp result={w.result} zone={zone} />
    </Panel>
  );
  const airPanel = (
    <Panel
      title="Calidad del aire"
      kicker="MODELO CAMS · US AQI"
      action={<Wind size={21} className="mint" />}
    >
      <div className="aq-main">
        <strong style={{ color: aq.color }}>
          {air?.current.us_aqi ?? "—"}
        </strong>
        <div>
          <span style={{ color: aq.color }}>{aq.label}</span>
          <small>Índice de calidad del aire</small>
        </div>
      </div>
      <div className="aq-scale" />
      <div className="aq-scale-label">
        <span>0 · Buena</span>
        <span>300+ · Peligrosa</span>
      </div>
      <div className="pollutants">
        {[
          ["PM2.5", air?.current.pm2_5],
          ["PM10", air?.current.pm10],
          ["O₃", air?.current.ozone],
          ["NO₂", air?.current.nitrogen_dioxide],
        ].map(([name, value]) => (
          <div key={name}>
            <small>{name}</small>
            <strong>
              {value ?? "—"} <small>µg/m³</small>
            </strong>
          </div>
        ))}
      </div>
      <p className="explain">{aq.advice}</p>
      {region === "pr" && (
        <p className="explain">
          Polvo mineral modelado: {air?.current.dust ?? "—"} µg/m³. Este valor
          por sí solo no confirma polvo del Sahara.
        </p>
      )}
      <Stamp result={a.result} zone={zone} />
      <p className="source-caption">
        Estimación regional Open-Meteo / CAMS; no es una medición de estación.
      </p>
    </Panel>
  );
  const quakeSummary = (
    <Panel
      title="Actividad sísmica"
      kicker={
        region === "pr"
          ? "PUERTO RICO + CARIBE CERCANO"
          : "REGIÓN ANDINA CERCANA"
      }
      action={
        <button className="text-button" onClick={() => navigate("sismos")}>
          Ver todos <ArrowUpRight size={16} />
        </button>
      }
    >
      <div className="quake-summary">
        <div>
          <strong>{q.result ? quakes.length : "—"}</strong>
          <small>eventos · últimos {days} días</small>
        </div>
        <div>
          <strong className="violet">
            {quakes.length
              ? Math.max(...quakes.map((f) => f.properties.mag)).toFixed(1)
              : "—"}
          </strong>
          <small>magnitud máxima</small>
        </div>
      </div>
      <Suspense fallback={<div className="chart skeleton" />}>
        <Chart
          data={dailyQuakes(quakes, zone, days).map((x: any) => ({
            label: x.date,
            value: x.count,
          }))}
          bar
          color="#ae95fa"
          unit="eventos"
        />
      </Suspense>
      <Stamp result={q.result} zone={zone} />
      <p className="source-caption">
        USGS · no predice terremotos · M ≥ {settings.mag}
      </p>
    </Panel>
  );
  const map = (
    <Suspense fallback={<div className="panel empty">Cargando mapa…</div>}>
      <MonitorMap
        place={place}
        places={places}
        quakes={quakes}
        alerts={shownAlerts}
        region={region}
        theme={settings.theme}
        unit={unit}
        onPlace={setPlace}
        preview={view === "inicio"}
      />
    </Suspense>
  );
  const alertsPanel = (
    <>
      <Panel
        title="Alertas oficiales"
        kicker={
          region === "pr" ? "NATIONAL WEATHER SERVICE" : "BOGOTÁ Y CUNDINAMARCA"
        }
        action={<ShieldCheck className="cyan" size={23} />}
      >
        {region === "co" ? (
          <div className="official-empty">
            <Radio size={32} />
            <h3>Consulta los boletines oficiales</h3>
            <p>
              No hay una fuente automatizada vigente verificada para Colombia.
              No se interpreta esto como ausencia de alertas. Consulta IDEAM e
              IDIGER antes de tomar decisiones.
            </p>
          </div>
        ) : !settings.showAlerts ? (
          <Empty text="Ocultaste las alertas en Ajustes. Puedes volver a activarlas allí." />
        ) : al.loading ? (
          <Empty text="Consultando alertas NWS…" />
        ) : al.error ? (
          <Empty text="No se pudo comprobar el estado de las alertas. Reintenta o consulta NWS." />
        ) : !shownAlerts.length ? (
          <div className="official-empty">
            <ShieldCheck size={34} />
            <h3>
              {al.result?.cached
                ? "Sin alertas en la consulta guardada"
                : "Sin alertas vigentes en la consulta"}
            </h3>
            <p>
              NWS no devolvió alertas activas para Puerto Rico. Esto no
              garantiza ausencia de riesgos locales.
            </p>
          </div>
        ) : (
          <div className="alerts-list">
            {shownAlerts.map((f) => (
              <article
                className={"alert-item " + f.properties.severity.toLowerCase()}
                key={String(f.id)}
              >
                <div className="alert-title">
                  <span className="tag amber">
                    OFICIAL · {severityNames[f.properties.severity]}
                  </span>
                  <strong>{f.properties.event}</strong>
                </div>
                <h3>{f.properties.headline}</h3>
                <p>{f.properties.areaDesc}</p>
                <details>
                  <summary>Descripción e instrucciones</summary>
                  <p className="preline">{f.properties.description}</p>
                  <p className="preline">{f.properties.instruction}</p>
                </details>
                <div className="alert-meta">
                  <span>
                    Emitida {fmt(f.properties.sent)}
                    <br />
                    Vigente hasta {fmt(f.properties.expires)}
                    <br />
                    {f.properties.senderName}
                  </span>
                  <SourceLink url={f.properties["@id"] || f.properties.id}>
                    Fuente NWS
                  </SourceLink>
                </div>
              </article>
            ))}
          </div>
        )}
        <Stamp result={al.result} zone={zone} />
        {region === "pr" && (
          <p className="source-caption">
            Cobertura: toda la isla · texto original de NWS, que puede estar en
            inglés.
          </p>
        )}
      </Panel>
      <Panel title="Fuentes oficiales" kicker="VERIFICA EN EL ORIGEN">
        <div className="source-list">
          {api.sources[region].map((s) => (
            <a href={s.url} target="_blank" rel="noreferrer" key={s.name}>
              <div>
                <strong>{s.name}</strong>
                <small>{s.note}</small>
              </div>
              <ArrowUpRight size={18} />
            </a>
          ))}
        </div>
      </Panel>
    </>
  );
  return (
    <>
      <a className="skip" href="#main">
        Saltar al contenido
      </a>
      <aside className="sidebar">
        <a className="brand" href="#inicio" onClick={() => navigate("inicio")}>
          <img src={import.meta.env.BASE_URL + "icon.svg"} alt="" />
          <span>
            PR ALERT<span>CENTER</span>
          </span>
        </a>
        <span className="sidebar-label">CENTRO DE MONITOREO</span>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={view === n.id ? "active" : ""}
              onClick={() => navigate(n.id)}
              aria-current={view === n.id ? "page" : undefined}
            >
              <n.icon size={20} />
              <span>{n.name}</span>
              {n.id === "alertas" &&
                region === "pr" &&
                shownAlerts.length > 0 && (
                  <span className="count">{shownAlerts.length}</span>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="coverage-mark">
            <span className="dot" />
            DATOS ABIERTOS
          </div>
          <p>
            Tu entorno.
            <br />
            Más cerca.
          </p>
          <small>
            Puerto Rico · Colombia
            <br />
            Acceso gratuito, siempre.
          </small>
          <button onClick={install}>
            <Download size={16} /> Instalar aplicación
          </button>
        </div>
      </aside>
      <div className="app-shell">
        <header className="topbar">
          <div className="mobile-brand">
            <img src={import.meta.env.BASE_URL + "icon.svg"} alt="" />
            <strong>PR Alert Center</strong>
          </div>
          <div className="region-switch" role="group" aria-label="Región">
            <button
              className={region === "pr" ? "selected" : ""}
              onClick={() => setRegion("pr")}
            >
              Puerto Rico
            </button>
            <button
              className={region === "co" ? "selected" : ""}
              onClick={() => setRegion("co")}
            >
              Bogotá y Cundinamarca
            </button>
          </div>
          <div className="top-actions">
            <span className="local-clock">
              {fmt(now, false)}{" "}
              <small>{region === "pr" ? "AST · UTC−4" : "COT · UTC−5"}</small>
            </span>
            <button
              aria-label="Cambiar apariencia"
              onClick={() =>
                patch({ theme: settings.theme === "dark" ? "light" : "dark" })
              }
            >
              {settings.theme === "dark" ? (
                <Sun size={19} />
              ) : (
                <Moon size={19} />
              )}
            </button>
            <button
              aria-label="Actualizar datos"
              onClick={() => {
                setNow(Date.now());
                setRefresh((x) => x + 1);
                setNotice(
                  "Consultando fuentes. Se reutilizan respuestas recientes para reducir solicitudes.",
                );
              }}
            >
              <RefreshCw size={18} className={loading ? "spin" : ""} />
            </button>
          </div>
        </header>
        <main id="main">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="dot" />
                {online ? "MONITOREO DE TU ENTORNO" : "SIN CONEXIÓN"}
              </div>
              <h1>
                {view === "inicio"
                  ? "Una mirada a tu región."
                  : nav.find((n) => n.id === view)?.name ||
                    "Centro de monitoreo"}
              </h1>
              <p>
                {view === "inicio"
                  ? "El tiempo, las alertas y la actividad natural. En un solo lugar."
                  : region === "pr"
                    ? "Puerto Rico y su entorno caribeño"
                    : "Bogotá D. C. y Cundinamarca"}
              </p>
            </div>
            <div className="location-controls">
              <label>
                <Compass size={17} />
                <select
                  aria-label="Seleccionar municipio o localidad"
                  value={place.id}
                  onChange={(e) =>
                    setPlace(places.find((p) => p.id === e.target.value)!)
                  }
                >
                  {places
                    .filter((p) => p.region === region)
                    .map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
              <button
                aria-label="Usar mi ubicación aproximada"
                onClick={locate}
              >
                <LocateFixed size={19} />
              </button>
              <button
                aria-label={
                  settings.favorites.includes(place.id)
                    ? "Quitar de favoritos"
                    : "Guardar favorito"
                }
                onClick={toggleFavorite}
              >
                <Heart
                  size={19}
                  fill={
                    settings.favorites.includes(place.id)
                      ? "currentColor"
                      : "none"
                  }
                />
              </button>
            </div>
          </div>
          {!online && (
            <div className="banner">
              <WifiOff size={18} /> Sin conexión. Se muestran datos guardados
              cuando están disponibles; los mapas pueden requerir internet.
            </div>
          )}
          {stale && online && (
            <div className="banner">
              Una fuente no respondió. Parte de la información procede de caché;
              revisa la fecha en cada módulo.
            </div>
          )}
          {apiErrors.length > 0 && (
            <div className="error-banner">
              <div>
                <strong>Algunas fuentes no están disponibles</strong>
                <p>{apiErrors.map(([n, e]) => `${n}: ${e}`).join(" · ")}</p>
              </div>
              <button onClick={() => setRefresh((x) => x + 1)}>
                Reintentar
              </button>
            </div>
          )}
          {needsUpdate && (
            <div className="banner">
              Hay una nueva versión disponible.{" "}
              <button onClick={() => updateServiceWorker(true)}>
                Actualizar aplicación
              </button>
            </div>
          )}
          {view === "inicio" && (
            <>
              <div className="dashboard-top">
                <section className="weather-hero living-weather">
                  <WeatherSky current={current} />
                  <div className="hero-meta">
                    <span className="tag">CONDICIONES DEL MODELO</span>
                    <span>{place.kind}</span>
                  </div>
                  <div className="hero-weather">
                    <div>
                      <h2>{place.name.replace(" · Bogotá", "")}</h2>
                      <p>
                        {new Date(now).toLocaleDateString("es-PR", {
                          timeZone: zone,
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })}
                      </p>
                      <div className="temperature">
                        {t(current?.temperature_2m)}
                        <span>{degree}</span>
                      </div>
                      <p className="condition">
                        {current
                          ? weatherLabel(current.weather_code)
                          : w.loading
                            ? "Cargando condiciones…"
                            : "Clima no disponible"}
                      </p>
                      <div className="high-low">
                        <ArrowUp size={15} />
                        {t(daily?.temperature_2m_max[0])}°{" "}
                        <ArrowDown size={15} />
                        {t(daily?.temperature_2m_min[0])}°{" "}
                        <span>
                          Sensación {t(current?.apparent_temperature)}°
                        </span>
                      </div>
                    </div>
                    <div className="hero-art">
                      <div className="orbit orbit-one" />
                      <div className="orbit orbit-two" />
                      <WeatherIcon
                        code={current?.weather_code}
                        day={current?.is_day !== 0}
                        size={112}
                      />
                    </div>
                  </div>
                  <div className="hero-bottom">
                    <Stamp result={w.result} zone={zone} />
                    <span>Open-Meteo · modelo {time(current?.time)}</span>
                  </div>
                </section>
                <section className="alert-overview">
                  <div className="alert-overview-top">
                    <span className="eyebrow">ESTADO DE ALERTAS</span>
                    <ShieldCheck size={27} />
                  </div>
                  <strong className="alert-number">
                    {region === "co" || !al.result
                      ? "—"
                      : officialAlerts.length.toString().padStart(2, "0")}
                  </strong>
                  <h2>
                    {region === "co"
                      ? "Consulta oficial externa"
                      : al.loading
                        ? "Consultando NWS…"
                        : al.error
                          ? "Fuente no disponible"
                          : officialAlerts.length
                            ? "Alertas oficiales vigentes"
                            : "Sin alertas en la consulta"}
                  </h2>
                  <p>
                    {region === "co"
                      ? "IDEAM · IDIGER · UNGRD"
                      : al.result?.cached
                        ? "Consulta guardada; verifica su fecha."
                        : "Fuente: National Weather Service · toda la isla"}
                  </p>
                  <button
                    className="wide-link"
                    onClick={() => navigate("alertas")}
                  >
                    Abrir centro de alertas <ArrowUpRight size={18} />
                  </button>
                </section>
              </div>
              <div className="metrics-grid">
                {[
                  {
                    icon: Droplets,
                    name: "Humedad",
                    value: current?.relative_humidity_2m,
                    suffix: "%",
                    sub: "Humedad relativa",
                    color: "cyan",
                  },
                  {
                    icon: Wind,
                    name: "Viento",
                    value: current?.wind_speed_10m,
                    suffix: "km/h",
                    sub: current
                      ? `Dirección ${current.wind_direction_10m}° · ráfagas ${current.wind_gusts_10m} km/h`
                      : "Modelo a 10 metros",
                    color: "mint",
                  },
                  {
                    icon: CloudRain,
                    name: "Lluvia",
                    value: weather?.hourly.precipitation_probability[hourIndex],
                    suffix: "%",
                    sub: "Probabilidad · hora actual",
                    color: "blue",
                  },
                  {
                    icon: Sun,
                    name: "Índice UV",
                    value: weather?.hourly.uv_index[hourIndex],
                    suffix: "",
                    sub: "Estimación · hora actual",
                    color: "amber",
                  },
                ].map((m) => (
                  <section className="metric" key={m.name}>
                    <div>
                      <span>{m.name}</span>
                      <m.icon size={22} className={m.color} />
                    </div>
                    <strong>
                      {m.value ?? "—"}
                      <small>{m.suffix}</small>
                    </strong>
                    <p>{m.sub}</p>
                  </section>
                ))}
              </div>
              <div className="dashboard-middle">
                <Panel
                  title="Así vienen las próximas horas"
                  kicker="PRONÓSTICO · 24 HORAS"
                  action={
                    <div className="segmented">
                      <button
                        className={chartMode === "temp" ? "selected" : ""}
                        onClick={() => setChartMode("temp")}
                      >
                        Temperatura
                      </button>
                      <button
                        className={chartMode === "rain" ? "selected" : ""}
                        onClick={() => setChartMode("rain")}
                      >
                        Lluvia
                      </button>
                    </div>
                  }
                >
                  <div className="chart-summary">
                    <strong>
                      {chartMode === "temp"
                        ? `${t(current?.temperature_2m)}${degree}`
                        : `${daily?.precipitation_sum[0] ?? "—"} mm`}
                    </strong>
                    <span>
                      {chartMode === "temp"
                        ? "Temperatura del modelo"
                        : "Acumulado previsto para hoy"}
                    </span>
                  </div>
                  <Suspense fallback={<div className="chart skeleton" />}>
                    <Chart
                      data={next24}
                      field={chartMode === "temp" ? "value" : "rain"}
                      unit={chartMode === "temp" ? degree : "mm"}
                      bar={chartMode === "rain"}
                    />
                  </Suspense>
                  <Stamp result={w.result} zone={zone} />
                </Panel>
                {airPanel}
              </div>
              <div className="dashboard-middle">
                {map}
                {quakeSummary}
              </div>
              {forecast}
              <Panel
                title="Actividad reciente"
                kicker="REGISTROS VERIFICABLES"
                action={
                  <button
                    className="text-button"
                    onClick={() => navigate("sismos")}
                  >
                    Explorar <ArrowUpRight size={15} />
                  </button>
                }
              >
                <div className="timeline">
                  {eventList.slice(0, 5).map((e) => (
                    <a href={e.url} key={e.id} target="_blank" rel="noreferrer">
                      <span
                        className={
                          "timeline-icon " +
                          (e.cat === "sismos" ? "violet" : "amber")
                        }
                      >
                        {e.cat === "sismos" ? (
                          <Activity size={18} />
                        ) : (
                          <Bell size={18} />
                        )}
                      </span>
                      <div>
                        <strong>{e.title}</strong>
                        <small>
                          {e.source} · {fmt(e.at)}
                        </small>
                      </div>
                      <ArrowUpRight size={16} />
                    </a>
                  ))}
                  {!eventList.length && (
                    <Empty text="No hay registros con los filtros actuales o la fuente no está disponible." />
                  )}
                </div>
              </Panel>
            </>
          )}
          {view === "mapa" && (
            <>
              {map}
              <div className="info-grid">
                <Panel title="Capas con datos reales" kicker="LECTURA DEL MAPA">
                  <p className="explain">
                    Los puntos meteorológicos son muestras de Open-Meteo; no
                    representan un radar ni una superficie continua. El mapa de
                    sismos se filtra con el umbral de Ajustes. Las alertas NWS
                    se dibujan solo cuando incluyen geometría.
                  </p>
                </Panel>
                <Panel title="Disponibilidad" kicker="TRANSPARENCIA">
                  <p className="explain">
                    No se incluyen capas continuas de radar, aire ni estaciones
                    colombianas sin integración verificada. La calidad del aire
                    modelada para tu ubicación está en Clima. El mapa base
                    requiere conexión.
                  </p>
                </Panel>
              </div>
            </>
          )}
          {view === "alertas" && (
            <div className="alert-layout">{alertsPanel}</div>
          )}
          {view === "sismos" && (
            <>
              <div className="filters">
                <label>
                  Magnitud mínima
                  <select
                    value={settings.mag}
                    onChange={(e) => patch({ mag: Number(e.target.value) })}
                  >
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((v) => (
                      <option key={v} value={v}>
                        M ≥ {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Periodo
                  <select
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                  >
                    <option value={1}>Últimas 24 horas</option>
                    <option value={7}>Últimos 7 días</option>
                  </select>
                </label>
                <label>
                  Buscar
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Lugar del evento"
                  />
                </label>
              </div>
              <div className="dashboard-middle">
                {quakeSummary}
                {map}
              </div>
              <Panel
                title="Últimos terremotos"
                kicker="USGS · EVENTOS REGISTRADOS"
              >
                <div className="quake-list">
                  {quakes
                    .filter((f) =>
                      String(f.properties.place)
                        .toLocaleLowerCase()
                        .includes(query.toLocaleLowerCase()),
                    )
                    .slice(0, 100)
                    .map((f) => (
                      <a
                        key={String(f.id)}
                        href={f.properties.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className="magnitude">
                          {f.properties.mag.toFixed(1)}
                          <small>MAGNITUD</small>
                        </span>
                        <div>
                          <strong>{f.properties.place}</strong>
                          <small>
                            {fmt(f.properties.time)} ·{" "}
                            {f.geometry.coordinates[2].toFixed(1)} km de
                            profundidad
                          </small>
                          <small>
                            {Math.round(
                              distance(
                                place.lat,
                                place.lon,
                                f.geometry.coordinates[1],
                                f.geometry.coordinates[0],
                              ),
                            )}{" "}
                            km de {place.name} ·{" "}
                            {f.geometry.coordinates[1].toFixed(3)},{" "}
                            {f.geometry.coordinates[0].toFixed(3)}
                          </small>
                        </div>
                        <ArrowUpRight size={18} />
                      </a>
                    ))}
                  {!quakes.length && (
                    <Empty
                      text={
                        q.loading
                          ? "Consultando USGS…"
                          : q.error
                            ? "No se recibieron datos sísmicos."
                            : "Sin eventos con los filtros actuales."
                      }
                    />
                  )}
                </div>
                <Stamp result={q.result} zone={zone} />
                <p className="explain">
                  Cobertura{" "}
                  {region === "pr" ? "16–21° N, 70–63° O" : "2–8° N, 77–71° O"}.
                  Los registros pueden ser revisados por USGS. No es un sistema
                  de alerta sísmica temprana ni una predicción.
                </p>
              </Panel>
              <Panel title="Cronología de actividad" kicker="ALERTAS + SISMOS">
                <div className="filters">
                  <label>
                    Categoría
                    <select
                      value={eventCategory}
                      onChange={(e) => setEventCategory(e.target.value)}
                    >
                      <option value="todos">Todas</option>
                      <option value="sismos">Sismos</option>
                      <option value="alertas">Alertas oficiales</option>
                    </select>
                  </label>
                  <label>
                    Relevancia
                    <select
                      value={eventSeverity}
                      onChange={(e) => setEventSeverity(e.target.value)}
                    >
                      <option value="todos">Todos</option>
                      <option value="destacados">
                        M ≥ 4 / alertas severas o extremas
                      </option>
                      <option value="otros">Otros registros</option>
                    </select>
                  </label>
                  <label>
                    Fecha local
                    <input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                    />
                  </label>
                </div>
                <div className="timeline">
                  {eventList.slice(0, 40).map((e) => (
                    <a href={e.url} key={e.id} target="_blank" rel="noreferrer">
                      <Activity size={20} className="violet" />
                      <div>
                        <strong>{e.title}</strong>
                        <small>
                          {fmt(e.at)} · {e.source}
                        </small>
                      </div>
                      <ExternalLink size={15} />
                    </a>
                  ))}
                  {!eventList.length && (
                    <Empty text="Sin registros para estos filtros." />
                  )}
                </div>
              </Panel>
            </>
          )}
          {view === "clima" && (
            <>
              <section className="weather-hero living-weather climate-sky">
                <WeatherSky current={current} />
                <span className="eyebrow">EL CIELO EN {place.name.toUpperCase()}</span>
                <h2>{t(current?.temperature_2m)}{degree} · {current ? weatherLabel(current.weather_code) : "Consultando clima…"}</h2>
                <p>Condiciones de modelo · animación ambiental ilustrativa</p>
                <div className="unit-switch" role="group" aria-label="Unidad de temperatura de esta región">
                  {(["f", "c"] as const).map(u => <button key={u} aria-pressed={unit === u} onClick={() => setUnit(u)}>°{u.toUpperCase()}</button>)}
                </div>
              </section>
              <div className="metrics-grid detailed">
                {[
                  {
                    icon: Thermometer,
                    label: "Sensación térmica",
                    value: `${t(current?.apparent_temperature)}${degree}`,
                  },
                  {
                    icon: Gauge,
                    label: "Presión en superficie",
                    value: `${current?.surface_pressure ?? "—"} hPa`,
                  },
                  {
                    icon: CloudRain,
                    label: "Precipitación prevista hoy",
                    value: `${daily?.precipitation_sum[0] ?? "—"} mm`,
                  },
                  {
                    icon: Eye,
                    label: "Visibilidad modelada",
                    value:
                      weather?.hourly.visibility[hourIndex] != null
                        ? `${(weather.hourly.visibility[hourIndex] / 1000).toFixed(1)} km`
                        : "—",
                  },
                  {
                    icon: CloudRain,
                    label: "Nubosidad",
                    value: `${current?.cloud_cover ?? "—"}%`,
                  },
                  {
                    icon: Wind,
                    label: "Ráfagas",
                    value: `${current?.wind_gusts_10m ?? "—"} km/h`,
                  },
                  {
                    icon: Sunrise,
                    label: "Amanecer",
                    value: time(daily?.sunrise[0]),
                  },
                  {
                    icon: Sunset,
                    label: "Atardecer",
                    value: time(daily?.sunset[0]),
                  },
                ].map((m) => (
                  <section className="metric" key={m.label}>
                    <div>
                      <span>{m.label}</span>
                      <m.icon size={20} className="cyan" />
                    </div>
                    <strong>{m.value}</strong>
                  </section>
                ))}
              </div>
              <div className="dashboard-middle">
                {forecast}
                {airPanel}
              </div>
              <ModelSignals weather={weather} />
              <Panel title="Pronóstico por hora" kicker="24 HORAS · HORA LOCAL">
                <div className="hourly-scroll">
                  {next24.map((h: any, i: number) => (
                    <div key={i}>
                      <small>{h.label}</small>
                      <WeatherIcon
                        code={weather?.hourly.weather_code[hourIndex + i]}
                        size={27}
                      />
                      <strong>{h.value ?? "—"}°</strong>
                      <span>{h.prob ?? "—"}%</span>
                      <small>{h.rain ?? "—"} mm</small>
                    </div>
                  ))}
                </div>
                <Stamp result={w.result} zone={zone} />
              </Panel>
              <div className="dashboard-middle">
                <Panel title="Temperatura" kicker="PRONÓSTICO HORARIO">
                  <Suspense>
                    <Chart data={next24} unit={degree} />
                  </Suspense>
                </Panel>
                <Panel title="Precipitación" kicker="ACUMULADO POR HORA">
                  <Suspense>
                    <Chart data={next24} field="rain" unit="mm" bar />
                  </Suspense>
                </Panel>
              </div>
              <Panel title="Evolución del aire" kicker="US AQI · MODELO CAMS">
                <Suspense>
                  <Chart
                    data={
                      air?.hourly.time
                        .slice(0, 48)
                        .map((x: string, i: number) => ({
                          label: time(x),
                          value: air.hourly.us_aqi[i],
                        })) || []
                    }
                    color="#6cddb9"
                    unit="US AQI"
                  />
                </Suspense>
                <p className="explain">
                  Horizonte del modelo, no historial de mediciones locales.
                  Valores en hora de la región seleccionada.
                </p>
                <Stamp result={a.result} zone={zone} />
              </Panel>
              <Panel
                title="Cómo interpretar los datos"
                kicker="ORIGEN Y LIMITACIONES"
              >
                <p className="explain">
                  Open-Meteo combina modelos meteorológicos. Las condiciones
                  actuales son estimaciones, no observaciones de una estación en
                  tiempo real. El pronóstico no constituye una alerta oficial.
                  La probabilidad de lluvia corresponde a la hora indicada; el
                  acumulado diario es un pronóstico. El aire proviene del modelo
                  CAMS con resolución regional.
                </p>
                <p className="explain">
                  {region === "pr"
                    ? "En Mapa puedes consultar estaciones NWS y abrir sus observaciones oficiales."
                    : "Para mediciones de estaciones, consulta RMCAB en las fuentes oficiales de Alertas."}
                </p>
              </Panel>
            </>
          )}
          {view === "ajustes" && (
            <div className="settings-grid">
              <Panel
                title="Tus preferencias"
                kicker="GUARDADAS EN ESTE DISPOSITIVO"
              >
                <div className="settings-fields">
                  <label>
                    Región principal
                    <select
                      value={region}
                      onChange={(e) => setRegion(e.target.value as Region)}
                    >
                      <option value="pr">Puerto Rico</option>
                      <option value="co">Bogotá y Cundinamarca</option>
                    </select>
                  </label>
                  <label>
                    Municipio o localidad favorita
                    <select
                      value={place.id}
                      onChange={(e) =>
                        setPlace(places.find((p) => p.id === e.target.value)!)
                      }
                    >
                      {places
                        .filter((p) => p.region === region)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Temperatura · {region === "pr" ? "Puerto Rico" : "Bogotá y Cundinamarca"}
                    <select
                      value={unit}
                      onChange={(e) =>
                        setUnit(e.target.value as "c" | "f")
                      }
                    >
                      <option value="c">Celsius · °C</option>
                      <option value="f">Fahrenheit · °F</option>
                    </select>
                  </label>
                  <label>
                    Apariencia
                    <select
                      value={settings.theme}
                      onChange={(e) =>
                        patch({ theme: e.target.value as "dark" | "light" })
                      }
                    >
                      <option value="dark">Oscura</option>
                      <option value="light">Clara</option>
                    </select>
                  </label>
                  <label>
                    Magnitud sísmica mínima
                    <select
                      value={settings.mag}
                      onChange={(e) => patch({ mag: Number(e.target.value) })}
                    >
                      {[0, 1, 2, 3, 4, 5, 6, 7].map((v) => (
                        <option key={v} value={v}>
                          M ≥ {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.showAlerts}
                      onChange={(e) => patch({ showAlerts: e.target.checked })}
                    />{" "}
                    Mostrar alertas oficiales
                  </label>
                </div>
                <h3>Ubicaciones guardadas</h3>
                <p className="explain">
                  Guarda cualquier ubicación con el corazón junto al selector.
                </p>
                <div className="favorites">
                  {settings.favorites.map((id) => {
                    const p = places.find((p) => p.id === id)!;
                    return (
                      <div key={id}>
                        <button onClick={() => setPlace(p)}>
                          {p.name} <ChevronRight size={15} />
                        </button>
                        <button
                          aria-label={"Quitar favorito " + p.name}
                          onClick={() =>
                            patch({
                              favorites: settings.favorites.filter(
                                (x) => x !== id,
                              ),
                            })
                          }
                        >
                          <X size={16} />
                        </button>
                      </div>
                    );
                  })}
                  {!settings.favorites.length && (
                    <small>Aún no tienes favoritos adicionales.</small>
                  )}
                </div>
              </Panel>
              <div>
                <Panel
                  title="Avisos e instalación"
                  kicker="TÚ TIENES EL CONTROL"
                >
                  <h3>Avisos con la aplicación abierta</h3>
                  <p className="explain">
                    Consulta fuentes cada 5 minutos mientras la aplicación está
                    visible. Puede avisarte de nuevos sismos que superen tu
                    umbral y alertas NWS. No hay vigilancia permanente ni push
                    con la app cerrada. No se contratan servidores ni servicios
                    de pago.
                  </p>
                  <button
                    className="primary"
                    onClick={
                      settings.notify ? () => patch({ notify: false }) : notify
                    }
                  >
                    <Bell size={17} />
                    {settings.notify ? "Desactivar avisos" : "Activar avisos"}
                  </button>
                  <h3>Instala PR Alert Center</h3>
                  <p className="explain">
                    En iPhone: Safari → Compartir → Añadir a pantalla de inicio.
                    En Android y escritorio: usa Instalar en un navegador
                    compatible. La caché permite consultar información guardada,
                    con su fecha visible.
                  </p>
                  <button onClick={install}>
                    <Download size={17} /> Instalar aplicación
                  </button>
                </Panel>
                <Panel title="Acerca de los datos" kicker="VERSIÓN 1.0.3">
                  <p className="explain">
                    Gratis, sin cuentas ni suscripciones. Preferencias y caché
                    se guardan en tu dispositivo. Las fuentes externas reciben
                    la ubicación del municipio consultado; la ubicación GPS se
                    usa solo para elegir el punto más cercano.
                  </p>
                  <p className="explain">
                    Geografía: US Census Gazetteer 2025 (78 municipios); Datos
                    Abiertos Colombia / DIVIPOLA (116 municipios de Cundinamarca
                    y Bogotá). Los centros de las 20 localidades de Bogotá son
                    aproximados; no son límites oficiales.
                  </p>
                  <p className="explain">
                    No sustituye los canales oficiales de emergencia. Los
                    servicios gratuitos pueden tener retrasos o interrupciones.
                  </p>
                  <div className="source-links">
                    <SourceLink url="https://open-meteo.com/">
                      Open-Meteo
                    </SourceLink>
                    <SourceLink url="https://atmosphere.copernicus.eu/">
                      CAMS
                    </SourceLink>
                    <SourceLink url="https://www.airnow.gov/aqi/aqi-basics/">
                      US AQI · AirNow
                    </SourceLink>
                    <SourceLink url="https://earthquake.usgs.gov/">
                      USGS
                    </SourceLink>
                    <SourceLink url="https://www.weather.gov/">NWS</SourceLink>
                    <SourceLink url="https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/">
                      Census Gazetteer
                    </SourceLink>
                    <SourceLink url="https://www.datos.gov.co/d/gdxc-w37w">
                      DIVIPOLA
                    </SourceLink>
                    <SourceLink url="https://www.ideca.gov.co/">
                      IDECA
                    </SourceLink>
                  </div>
                  <button
                    onClick={() => {
                      navigator.serviceWorker
                        ?.getRegistration()
                        .then((r) => r?.update());
                      setRefresh((x) => x + 1);
                      setNotice(
                        "Se comprobó la actualización de la aplicación y se consultaron las fuentes.",
                      );
                    }}
                  >
                    <RefreshCw size={16} /> Comprobar actualizaciones
                  </button>
                </Panel>
              </div>
            </div>
          )}
          <footer>
            <span>
              PR ALERT CENTER <span className="footer-dot">/</span> TU ENTORNO,
              EN PERSPECTIVA.
            </span>
            <small>
              Open-Meteo · CAMS · USGS · NWS{" "}
              <button
                className="text-button"
                onClick={() => navigate("ajustes")}
              >
                Fuentes y alcance ↗
              </button>
            </small>
          </footer>
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Navegación móvil">
        {nav.map((n) => (
          <button
            key={n.id}
            className={view === n.id ? "active" : ""}
            onClick={() => navigate(n.id)}
            aria-current={view === n.id ? "page" : undefined}
          >
            <n.icon size={20} />
            <span>{n.name}</span>
          </button>
        ))}
      </nav>
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button aria-label="Cerrar aviso" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {installHelp && (
        <div className="modal-backdrop" onClick={() => setInstallHelp(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-title"
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Cerrar instrucciones"
              onClick={() => setInstallHelp(false)}
              autoFocus
            >
              <X size={20} />
            </button>
            <img src={import.meta.env.BASE_URL + "icon-192.png"} alt="" />
            <h2 id="install-title">
              Tu centro de monitoreo,
              <br />a un toque.
            </h2>
            <p>
              iPhone: abre en Safari, toca Compartir y luego «Añadir a pantalla
              de inicio».
            </p>
            <p>
              Android y computadora: abre el menú del navegador y selecciona
              «Instalar aplicación» cuando esté disponible.
            </p>
            <button className="primary" onClick={() => setInstallHelp(false)}>
              Entendido
            </button>
          </section>
        </div>
      )}
    </>
  );
}
