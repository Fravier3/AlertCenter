import DeviceLocation from "./DeviceLocation";
import { useRadar, RadarTiles, RadarControls } from "./Radar";
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
  onForecast,
  locationRequested = false,
  onLocationConsumed,
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
  onForecast: () => void;
  locationRequested?: boolean;
  onLocationConsumed: () => void;
}) {
  const [tracking, setTracking] = useState(false);
  const [locationAttempt, setLocationAttempt] = useState(0);
  const [trackingStatus, setTrackingStatus] = useState("");
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

  const [layer, setLayer] = useState("sismos");
  const radar = useRadar(layer === "radar", place);
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
    <section
      className={
        "map-card " +
        (theme === "dark" ? "map-night " : "") +
        (preview ? "map-preview" : "")
      }
    >
      <div className="map-toolbar">
        <div>
          <span className="eyebrow">EXPLORA TU REGIÓN</span>
          <h2>Mapa de monitoreo</h2>
        </div>
        <div className="map-actions">
          <button
            aria-pressed={tracking}
            onClick={() => {
              setTracking(!tracking);
              setTrackingStatus(
                tracking
                  ? "Seguimiento detenido; la posición GPS ya no se muestra."
                  : "",
              );
            }}
          >
            {tracking ? "Detener seguimiento" : "Seguir mi ubicación"}
          </button>
          <button
            onClick={() => {
              setTracking(false);
              setTrackingStatus("");
              setCenter((x) => x + 1);
            }}
          >
            Centrar región
          </button>
        </div>
      </div>
      <div className="map-wrap">
        <MapContainer
          center={[place.lat, place.lon]}
          zoom={9}
          scrollWheelZoom={!preview}
          className="map"
        >
          <DeviceLocation
            active={tracking}
            attempt={locationAttempt}
            onStatus={setTrackingStatus}
          />
          <Focus key={center} place={place} region={region} />
          <TileLayer
            key="openstreetmap"
            className="map-base"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
            eventHandlers={{
              tileerror: () =>
                setStatus(
                  "No se pudo cargar el mapa. Comprueba tu conexión y vuelve a abrir esta sección.",
                ),
            }}
          />
          {layer === "radar" && <RadarTiles radar={radar} region={region} />}
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
      {(tracking || trackingStatus) && (
        <p className="map-note" role="status">
          {trackingStatus} El seguimiento se detiene al salir del mapa; la
          pantalla bloqueada puede suspenderlo.
        </p>
      )}
      <details className="location-help">
        <summary>¿No aparece tu ubicación real?</summary>
        <p>
          El marcador TÚ aparece únicamente al recibir coordenadas del
          dispositivo. La ciudad del selector corresponde a los datos del clima,
          no a tu GPS.
        </p>
        <p>
          iPhone: Ajustes → Privacidad y seguridad → Localización. Activa
          Localización y permite el acceso a Safari o a esta app; activa
          Ubicación precisa si aparece. En Safari, abre el menú de la página →
          ajustes del sitio web → Ubicación → Permitir. Los nombres pueden
          variar según iOS.
        </p>
        <p>
          Mantén la app visible. Si el dispositivo no tiene buena señal, prueba
          cerca de una ventana o al aire libre.
        </p>
        <button
          onClick={() => {
            setTracking(true);
            setLocationAttempt((v) => v + 1);
          }}
        >
          Reintentar ubicación
        </button>
        <p>
          No se guarda tu recorrido. Los sismos conservan sus colores y la
          posición GPS utiliza una etiqueta TÚ, sin círculo de ciudad.
        </p>
      </details>
      <div className="layer-bar" role="group" aria-label="Capas del mapa">
        {[
          ["sismos", "Sismos"],
          ["municipios", "Ubicaciones"],
          ["alertas", "Alertas"],
          ["temperatura", "Temperatura"],
          ["lluvia", "Lluvia · modelo"],
          ["radar", "Radar de lluvia"],
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
      {layer === "radar" && (
        <RadarControls radar={radar} place={place} onForecast={onForecast} />
      )}
      {layer !== "radar" && (
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
      )}
    </section>
  );
}
