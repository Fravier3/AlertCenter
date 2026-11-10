import type { Place, Region, Weather, Air, Feature, Result } from "../types";
import { bounds, activeAlerts, zones } from "./domain.mjs";
const pending = new Map<string, Promise<Result<any>>>();
export function readStore(key: string) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}
export function writeStore(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* App remains usable when storage is blocked. */
  }
}
export async function cached<T>(
  key: string,
  url: string,
  ttl = 600000,
  valid: (x: any) => boolean = () => true,
): Promise<Result<T>> {
  const full = "ac:data:" + key;
  const old = readStore(full);
  if (old && Date.now() - old.at < ttl && valid(old.data))
    return { ...old, cached: false };
  if (pending.has(full)) return pending.get(full)!;
  const job = (async () => {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(18000) });
      if (!r.ok) throw Error(`La fuente respondió ${r.status}`);
      const data = await r.json();
      if (!valid(data)) throw Error("Respuesta incompleta de la fuente");
      const result = { data, at: Date.now(), cached: false };
      writeStore(full, result);
      try {
        const keys = Object.keys(localStorage).filter((k) =>
          k.startsWith("ac:data:"),
        );
        if (keys.length > 32)
          keys
            .sort((a, b) => (readStore(a)?.at || 0) - (readStore(b)?.at || 0))
            .slice(0, keys.length - 32)
            .forEach((k) => localStorage.removeItem(k));
      } catch {}
      return result;
    } catch (e) {
      if (old && valid(old.data)) return { ...old, cached: true };
      throw e;
    } finally {
      pending.delete(full);
    }
  })();
  pending.set(full, job);
  return job;
}
const weatherFields = {
  current:
    "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
  hourly:
    "temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,visibility,uv_index,wind_speed_10m",
  daily:
    "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max",
};
export function weather(p: Place) {
  const q = new URLSearchParams({
    latitude: String(p.lat),
    longitude: String(p.lon),
    timezone: zones[p.region],
    ...weatherFields,
    forecast_days: "7",
  });
  return cached<Weather>(
    "weather:" + p.id,
    "https://api.open-meteo.com/v1/forecast?" + q,
    600000,
    (x) => !!x.current && !!x.hourly && !!x.daily,
  );
}
export function air(p: Place) {
  const q = new URLSearchParams({
    latitude: String(p.lat),
    longitude: String(p.lon),
    timezone: zones[p.region],
    current: "us_aqi,pm10,pm2_5,nitrogen_dioxide,ozone,dust",
    hourly: "us_aqi,pm2_5,pm10,dust",
    forecast_days: "3",
  });
  return cached<Air>(
    "air:" + p.id,
    "https://air-quality-api.open-meteo.com/v1/air-quality?" + q,
    1800000,
    (x) => !!x.current && !!x.hourly,
  );
}
export function earthquakes(region: Region) {
  const q = new URLSearchParams({
    format: "geojson",
    starttime: new Date(Date.now() - 7 * 86400000).toISOString(),
    orderby: "time",
    limit: "2000",
    ...Object.fromEntries(
      Object.entries(bounds[region]).map(([k, v]) => [k, String(v)]),
    ),
  });
  return cached<{ features: Feature[] }>(
    "quakes:" + region,
    "https://earthquake.usgs.gov/fdsnws/event/1/query?" + q,
    300000,
    (x) => Array.isArray(x.features),
  );
}
export async function alerts(region: Region) {
  if (region === "co") return null;
  const r = await cached<{ features: Feature[]; updated: string }>(
    "alerts:pr",
    "https://api.weather.gov/alerts/active?area=PR",
    120000,
    (x) => Array.isArray(x.features),
  );
  return { ...r, data: { ...r.data, features: activeAlerts(r.data.features) } };
}
export const sources = {
  pr: [
    {
      name: "NWS San Juan",
      url: "https://www.weather.gov/sju/",
      note: "Pronósticos, alertas y observaciones oficiales",
    },
    {
      name: "National Hurricane Center",
      url: "https://www.nhc.noaa.gov/",
      note: "Ciclones tropicales · consulta oficial externa",
    },
    {
      name: "Red Sísmica de Puerto Rico",
      url: "https://redsismica.uprm.edu/",
      note: "Boletines locales · consulta oficial externa",
    },
  ],
  co: [
    {
      name: "IDEAM · boletines vigentes",
      url: "https://www.ideam.gov.co/sala-de-prensa/boletines",
      note: "Consulta oficial externa · sin conteo automático de alertas",
    },
    {
      name: "IDIGER · Sistema de Alerta de Bogotá",
      url: "https://www.sab.gov.co/",
      note: "Monitoreo distrital · consulta oficial externa",
    },
    {
      name: "UNGRD",
      url: "https://portal.gestiondelriesgo.gov.co/",
      note: "Información nacional · consulta oficial externa",
    },
    {
      name: "Servicio Geológico Colombiano",
      url: "https://www.sgc.gov.co/sismos",
      note: "Boletines sísmicos · consulta oficial externa",
    },
    {
      name: "RMCAB",
      url: "https://rmcab.ambientebogota.gov.co/",
      note: "Estaciones de aire · consulta oficial externa",
    },
  ],
};
