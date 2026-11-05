export const zones = { pr: "America/Puerto_Rico", co: "America/Bogota" };
export const bounds = {
  pr: {
    minlatitude: 16,
    maxlatitude: 21,
    minlongitude: -70,
    maxlongitude: -63,
  },
  co: { minlatitude: 2, maxlatitude: 8, minlongitude: -77, maxlongitude: -71 },
};
export function distance(a, b, c, d) {
  const r = Math.PI / 180;
  const s =
    Math.sin(((c - a) * r) / 2) ** 2 +
    Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
export function temp(value, unit = "c") {
  return value == null || !Number.isFinite(value)
    ? "—"
    : Math.round(unit === "f" ? (value * 9) / 5 + 32 : value);
}
export function aqiCategory(v) {
  if (v == null)
    return {
      label: "No disponible",
      color: "#8a9ab3",
      advice: "No se recibieron datos del modelo.",
    };
  if (v <= 50)
    return {
      label: "Buena",
      color: "#54dbaa",
      advice: "Calidad del aire satisfactoria según el índice US AQI.",
    };
  if (v <= 100)
    return {
      label: "Moderada",
      color: "#f4cd65",
      advice:
        "Las personas especialmente sensibles deben considerar reducir el esfuerzo prolongado al aire libre.",
    };
  if (v <= 150)
    return {
      label: "Dañina para sensibles",
      color: "#ff9a62",
      advice:
        "Grupos sensibles: reduzcan el esfuerzo prolongado al aire libre.",
    };
  if (v <= 200)
    return {
      label: "Dañina",
      color: "#ff7187",
      advice:
        "Reduzcan el esfuerzo prolongado al aire libre; los grupos sensibles deben evitarlo.",
    };
  if (v <= 300)
    return {
      label: "Muy dañina",
      color: "#c899fa",
      advice:
        "Eviten el esfuerzo al aire libre y sigan las indicaciones oficiales.",
    };
  return {
    label: "Peligrosa",
    color: "#ed719e",
    advice:
      "Eviten actividades al aire libre y consulten las indicaciones oficiales.",
  };
}
export function weatherLabel(c) {
  if (c === 0) return "Despejado";
  if (c <= 3) return "Parcialmente nublado";
  if (c <= 48) return "Niebla";
  if (c <= 57) return "Llovizna";
  if (c <= 67) return "Lluvia";
  if (c <= 77) return "Nieve";
  if (c <= 82) return "Aguaceros";
  if (c <= 86) return "Chubascos de nieve";
  if (c >= 95) return "Tormenta eléctrica";
  return "Condiciones variables";
}
export function modelTime(value, offset = 0) {
  return Date.parse(value + "Z") - offset * 1000;
}
export function activeAlerts(features, now = Date.now()) {
  return features.filter((f) => {
    const p = f.properties;
    return (
      p.status === "Actual" &&
      p.messageType !== "Cancel" &&
      Date.parse(p.expires) > now &&
      (!p.effective || Date.parse(p.effective) <= now)
    );
  });
}
export function dailyQuakes(features, zone, days = 7, now = Date.now()) {
  const fmt = new Intl.DateTimeFormat("sv-SE", { timeZone: zone });
  const map = new Map();
  for (let i = days - 1; i >= 0; i--)
    map.set(fmt.format(new Date(now - i * 86400000)), 0);
  features.forEach((f) => {
    const key = fmt.format(new Date(f.properties.time));
    if (map.has(key)) map.set(key, map.get(key) + 1);
  });
  return [...map].map(([date, count]) => ({ date: date.slice(5), count }));
}
export function safeSettings(value, places) {
  const base = {
    region: "pr",
    placeId: "72127",
    theme: "dark",
    unit: "c",
    mag: 0,
    favorites: [],
    showAlerts: true,
    notify: false,
  };
  if (!value || typeof value !== "object") return base;
  const p = places.find((p) => p.id === value.placeId);
  return {
    ...base,
    region: p?.region || "pr",
    placeId: p?.id || base.placeId,
    theme: value.theme === "light" ? "light" : "dark",
    unit: value.unit === "f" ? "f" : "c",
    mag: Number.isFinite(value.mag) ? Math.max(0, Math.min(7, value.mag)) : 0,
    favorites: Array.isArray(value.favorites)
      ? value.favorites.filter((id) => places.some((p) => p.id === id))
      : [],
    showAlerts: value.showAlerts !== false,
    notify: value.notify === true,
  };
}
