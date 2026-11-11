// Spanish presentation of NWS alerts. Event names follow the NWS convention:
// Warning = Aviso, Watch = Vigilancia, Advisory = Advertencia.
const kinds = [
  ["Warning", "Aviso"],
  ["Watch", "Vigilancia"],
  ["Advisory", "Advertencia"],
  ["Statement", "Comunicado"],
  ["Outlook", "Perspectiva"],
  ["Alert", "Alerta"],
  ["Emergency", "Emergencia"],
];
const hazards = {
  "Flash Flood": "de inundaciones repentinas",
  Flood: "de inundaciones",
  "Coastal Flood": "de inundaciones costeras",
  "High Surf": "de oleaje fuerte",
  "Rip Current": "de corrientes marinas",
  "Beach Hazards": "de peligros en las playas",
  "Small Craft": "para embarcaciones pequeñas",
  "Special Marine": "marítimo especial",
  "Marine Weather": "del tiempo marítimo",
  "Special Weather": "especial del tiempo",
  "Hazardous Weather": "de tiempo peligroso",
  "Hazardous Seas": "de mar peligroso",
  Gale: "de vientos de galerna",
  Hurricane: "de huracán",
  "Hurricane Local": "local de huracán",
  "Tropical Storm": "de tormenta tropical",
  "Tropical Cyclone": "de ciclón tropical",
  "Storm Surge": "de marejada ciclónica",
  "Severe Thunderstorm": "de tormenta eléctrica severa",
  "Severe Weather": "de tiempo severo",
  Tornado: "de tornado",
  Tsunami: "de tsunami",
  Heat: "de calor",
  "Excessive Heat": "de calor excesivo",
  "Extreme Heat": "de calor extremo",
  Wind: "de viento",
  "High Wind": "de vientos fuertes",
  "Dense Fog": "de niebla densa",
  "Red Flag": "de bandera roja (riesgo de incendios)",
  "Fire Weather": "de condiciones para incendios",
  "Air Quality": "de calidad del aire",
  Hydrologic: "hidrológica",
  "Dust": "de polvo",
  "Blowing Dust": "de polvo en suspensión",
  "Flood Short Term Forecast": "de pronóstico de inundaciones a corto plazo",
};
export function eventEs(event) {
  const name = String(event ?? "").trim();
  for (const [en, es] of kinds) {
    if (!name.endsWith(" " + en)) continue;
    const hazard = hazards[name.slice(0, -en.length - 1)];
    if (hazard) return `${es} ${hazard}`;
  }
  return name || "Alerta";
}
const labels = {
  severity: {
    Extreme: "Extrema",
    Severe: "Severa",
    Moderate: "Moderada",
    Minor: "Menor",
    Unknown: "No especificada",
  },
  urgency: {
    Immediate: "Actúa de inmediato",
    Expected: "Se espera pronto",
    Future: "Próximas horas o días",
    Past: "Ya ocurrió",
  },
  certainty: {
    Observed: "Observado",
    Likely: "Probable",
    Possible: "Posible",
    Unlikely: "Poco probable",
  },
};
export const labelEs = (field, value) => labels[field]?.[value] ?? "";

/** NWS hard-wraps lines; rebuild paragraphs so they read and translate well. */
export function paragraphs(text) {
  return String(text ?? "")
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}
const spanishWords =
  /\b(el|la|los|las|de|del|para|hasta|esta|está|con|por|que|una|se|en)\b/gi;
/** NWS San Juan sometimes publishes the text already in Spanish. */
export function looksSpanish(text) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean).length;
  if (words < 4) return false;
  const hits = (String(text).match(spanishWords) || []).length;
  return /[áéíóúñ¿¡]/i.test(text) || hits / words > 0.2;
}
/** Split on sentence boundaries so each request stays under a size limit. */
export function chunks(text, max = 450) {
  const out = [];
  let current = "";
  for (const piece of String(text).match(/[^.!?]+[.!?]*\s*/g) || []) {
    for (let i = 0; i < piece.length; i += max) {
      const part = piece.slice(i, i + max);
      if (current && (current + part).length > max) {
        out.push(current.trim());
        current = "";
      }
      current += part;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}
