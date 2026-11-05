// Only observed, dated radar frames are accepted. No generated future imagery.
export function normalizeRadarManifest(input, now = Date.now()) {
  let host;
  try {
    const u = new URL(input?.host);
    if (
      u.protocol !== "https:" ||
      !/^(tilecache\d*\.)rainviewer\.com$/.test(u.hostname) ||
      u.port ||
      u.username ||
      u.password
    )
      throw Error();
    host = u.origin;
  } catch {
    throw Error("Origen del radar no válido");
  }
  if (!Array.isArray(input?.radar?.past))
    throw Error("La fuente no devolvió imágenes de radar");
  const unique = new Map();
  for (const f of input.radar.past) {
    if (
      Number.isFinite(f?.time) &&
      f.time > 0 &&
      f.time * 1000 <= now + 60000 &&
      /^\/v2\/radar\/[a-zA-Z0-9_-]+$/.test(f.path)
    )
      unique.set(f.time, { time: f.time, path: f.path });
  }
  const frames = [...unique.values()]
    .sort((a, b) => a.time - b.time)
    .slice(-13);
  if (!frames.length) throw Error("Sin imágenes observadas disponibles");
  return { host, frames };
}
export function radarTiles(host, frame) {
  return `${host}${frame.path}/256/{z}/{x}/{y}/2/1_0.png`;
}
export function coverageTiles(host) {
  return `${host}/v2/coverage/0/256/{z}/{x}/{y}/0/0_0.png`;
}
export function coveragePoint(host, lat, lon) {
  return `${host}/v2/coverage/0/256/7/${Number(lat).toFixed(4)}/${Number(lon).toFixed(4)}/0/0_0.png`;
}
export function radarFrameLabel(time, zone, now = Date.now()) {
  const minutes = Math.round((now - time * 1000) / 60000);
  return `${new Date(time * 1000).toLocaleString("es-PR", { timeZone: zone, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · ${minutes > 30 ? "imagen histórica · " : ""}hace ${Math.max(0, minutes)} min`;
}
