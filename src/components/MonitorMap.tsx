import { temp } from "../services/domain.mjs";
import StationObservation from "./StationObservation";
import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  GeoJSON,
  useMap,
} from "react-leaflet";
import type { Place, Feature, Region } from "../types";
import { sampleWeather, stations } from "../services/api";
import "leaflet/dist/leaflet.css";
function Focus({ place, region }: { place: Place; region: Region }) {
  const map = useMap();
  useEffect(() => {
    map.setView([place.lat, place.lon], region === "pr" ? 9 : 10);
    setTimeout(() => map.invalidateSize(), 200);
  }, [place, region, map]);
  return null;
}
export default function MonitorMap({
  place,
  places,
  quakes,
  alerts,
  region,
  theme,
  unit,
  onPlace,
  preview = false,
}: {
  place: Place;
  places: Place[];
  quakes: Feature[];
  alerts: Feature[];
  region: Region;
  theme: string;
  unit: "c" | "f";
  onPlace: (p: Place) => void;
  preview?: boolean;
}) {
  const [layer, setLayer] = useState("sismos");
  const [samples, setSamples] = useState<any[]>([]);
  const [stationData, setStations] = useState<Feature[]>([]);
  const [status, setStatus] = useState("");
  const [center, setCenter] = useState(0);
  useEffect(() => {
    setSamples([]);
    setStations([]);
    setStatus("");
  }, [region]);
  useEffect(() => {
    let alive = true;
    if (["temperatura", "lluvia", "viento"].includes(layer)) {
      setStatus("Consultando puntos del modelo…");
      sampleWeather(places, region)
        .then((r) => {
          if (alive) {
            setSamples(r.data);
            setStatus(
              `${r.cached ? "Caché · " : ""}Open-Meteo · puntos de modelo · ${new Date(r.at).toLocaleTimeString("es-PR")}`,
            );
          }
        })
        .catch(() => {
          if (alive)
            setStatus(
              "No se pudo cargar esta capa. Cambia de capa para reintentar.",
            );
        });
    } else if (layer === "estaciones" && region === "pr") {
      setStatus("Consultando estaciones NWS…");
      stations()
        .then((r) => {
          if (alive) {
            setStations(r.data.features);
            setStatus(
              "Hasta 100 estaciones NWS · ubicación, no medición en vivo",
            );
          }
        })
        .catch(() => {
          if (alive) setStatus("Estaciones no disponibles.");
        });
    } else setStatus("");
    return () => {
      alive = false;
    };
  }, [layer, region, places]);
  return (
    <section className={"map-card " + (theme === "dark" ? "map-night " : "") + (preview ? "map-preview" : "")}>
      <div className="map-toolbar">
        <div>
          <span className="eyebrow">EXPLORA TU REGIÓN</span>
          <h2>Mapa de monitoreo</h2>
        </div>
        <button onClick={() => setCenter((x) => x + 1)}>Centrar región</button>
      </div>
      <div className="map-wrap">
        <MapContainer
          center={[place.lat, place.lon]}
          zoom={9}
          scrollWheelZoom={!preview}
          className="map"
        >
          <Focus key={center} place={place} region={region} />
          <TileLayer
            key="openstreetmap"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
            eventHandlers={{ tileerror: () => setStatus("No se pudo cargar el mapa. Comprueba tu conexión y vuelve a abrir esta sección.") }}
          />
          <CircleMarker
            center={[place.lat, place.lon]}
            radius={9}
            pathOptions={{ color: "#55e7f1", fillOpacity: 0.35, weight: 3 }}
          >
            <Popup>
              {place.name}
              <br />
              Ubicación seleccionada
            </Popup>
          </CircleMarker>
          {layer === "municipios" &&
            places
              .filter((p) => p.region === region)
              .map((p) => (
                <CircleMarker
                  key={p.id}
                  center={[p.lat, p.lon]}
                  radius={4}
                  pathOptions={{ color: "#55d7ee", fillOpacity: 0.7 }}
                  eventHandlers={{ click: () => onPlace(p) }}
                >
                  <Popup>
                    {p.name}
                    <br />
                    {p.kind}
                  </Popup>
                </CircleMarker>
              ))}
          {layer === "sismos" &&
            quakes
              .filter((q) => q.geometry?.coordinates)
              .map((q) => (
                <CircleMarker
                  key={q.id}
                  center={[
                    q.geometry.coordinates[1],
                    q.geometry.coordinates[0],
                  ]}
                  radius={Math.max(4, (q.properties.mag || 0) * 3)}
                  pathOptions={{
                    color: q.properties.mag >= 4 ? "#ff8a8d" : "#b69aff",
                    fillOpacity: 0.3,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <strong>
                      M {q.properties.mag ?? "—"} · {q.properties.place}
                    </strong>
                    <p>
                      {new Date(q.properties.time).toLocaleString("es-PR", {
                        timeZone:
                          region === "pr"
                            ? "America/Puerto_Rico"
                            : "America/Bogota",
                      })}
                      <br />
                      Profundidad: {q.geometry.coordinates[2]} km
                    </p>
                    <a href={q.properties.url} target="_blank" rel="noreferrer">
                      Evento USGS ↗
                    </a>
                  </Popup>
                </CircleMarker>
              ))}
          {layer === "alertas" &&
            alerts
              .filter((a) => a.geometry)
              .map((a) => (
                <GeoJSON
                  key={String(a.id)}
                  data={a as any}
                  style={{
                    color:
                      a.properties.severity === "Extreme"
                        ? "#ff5878"
                        : "#ffca75",
                    weight: 2,
                    fillOpacity: 0.2,
                  }}
                >
                  <Popup>{a.properties.headline || a.properties.event}</Popup>
                </GeoJSON>
              ))}
          {["temperatura", "lluvia", "viento"].includes(layer) &&
            samples.map((p) => (
              <CircleMarker
                key={p.id}
                center={[p.lat, p.lon]}
                radius={12}
                pathOptions={{
                  color:
                    layer === "temperatura"
                      ? "#f6bc77"
                      : layer === "lluvia"
                        ? "#55caff"
                        : "#6ee1c2",
                  fillOpacity: 0.5,
                }}
              >
                <Popup>
                  <strong>{p.name}</strong>
                  <p>
                    {layer === "temperatura"
                      ? `${temp(p.temperature_2m, unit)} °${unit.toUpperCase()}`
                      : layer === "lluvia"
                        ? `${p.precipitation} mm (intervalo actual del modelo)`
                        : `${p.wind_speed_10m} km/h`}
                  </p>
                  Open-Meteo · modelo, no estación
                </Popup>
              </CircleMarker>
            ))}
          {layer === "estaciones" &&
            stationData
              .filter((s) => s.geometry?.coordinates)
              .map((s) => (
                <CircleMarker
                  key={s.id}
                  center={[
                    s.geometry.coordinates[1],
                    s.geometry.coordinates[0],
                  ]}
                  radius={5}
                  pathOptions={{ color: "#70dfba" }}
                >
                  <Popup>
                    <StationObservation station={s} unit={unit} />
                  </Popup>
                </CircleMarker>
              ))}
        </MapContainer>
        <div className="map-badge">
          <span className="dot" />
          {region === "pr" ? "PUERTO RICO" : "BOGOTÁ + CUNDINAMARCA"}
        </div>
      </div>
      <div className="layer-bar" role="group" aria-label="Capas del mapa">
        {[
          ["sismos", "Sismos"],
          ["municipios", "Ubicaciones"],
          ["alertas", "Alertas"],
          ["temperatura", "Temperatura"],
          ["lluvia", "Lluvia"],
          ["viento", "Viento"],
          ...(region === "pr" ? [["estaciones", "Estaciones"]] : []),
        ].map(([id, label]) => (
          <button
            key={id}
            className={layer === id ? "selected" : ""}
            onClick={() => setLayer(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="map-note">
        {status ||
          (layer === "sismos"
            ? "● Violeta: sismos USGS · coral: magnitud ≥ 4 · tamaño según magnitud"
            : layer === "alertas"
              ? region === "co"
                ? "Colombia: capa vigente no disponible. Consulta los boletines oficiales."
                : `${alerts.filter((a) => a.geometry).length} alertas con geometría. Las alertas sin polígono se muestran en Alertas.`
              : "Toca un punto para consultar su información.")}{" "}
        {["temperatura", "lluvia", "viento"].includes(layer) &&
          "Sin interpolación ni radar: cada punto representa un modelo local."}
      </p>
    </section>
  );
}
