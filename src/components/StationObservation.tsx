import { temp } from "../services/domain.mjs";
import { useState } from "react";
import type { Feature, Result } from "../types";
import { observation } from "../services/api";
export default function StationObservation({ station, unit = "c" }: { station: Feature; unit?: "c" | "f" }) {
  const [result, setResult] = useState<Result<{ properties: any }> | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const url = String(station.id);
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setResult(await observation(url));
    } catch {
      setError(
        "No se recibió una observación. Algunas estaciones no tienen registros recientes.",
      );
    } finally {
      setLoading(false);
    }
  };
  const p = result?.data.properties;
  const value = (v: any) =>
    v?.value == null ? "—" : Math.round(v.value * 10) / 10;
  const old = p && Date.now() - Date.parse(p.timestamp) > 3600000;
  return (
    <div className="station-observation">
      <strong>{station.properties.name}</strong>
      <p>Estación NWS · {station.properties.stationIdentifier}</p>
      {!p && (
        <button onClick={load} disabled={loading}>
          {loading ? "Consultando…" : "Consultar última observación"}
        </button>
      )}
      {error && <p role="status">{error}</p>}
      {p && (
        <>
          <span className="tag">OBSERVACIÓN DE ESTACIÓN</span>
          <p>
            Temperatura: {temp(p.temperature?.value, unit)} °{unit.toUpperCase()}
            <br />
            Humedad: {value(p.relativeHumidity)} %<br />
            Viento: {value(p.windSpeed)} km/h
            <br />
            Presión:{" "}
            {p.barometricPressure?.value == null
              ? "—"
              : Math.round(p.barometricPressure.value / 100)}{" "}
            hPa
          </p>
          <p>
            {old ? "Registro antiguo · " : ""}
            {result?.cached ? "Consulta guardada · " : ""}
            {new Date(p.timestamp).toLocaleString("es-PR", {
              timeZone: "America/Puerto_Rico",
            })}
          </p>
          {p.textDescription && <p>{p.textDescription}</p>}
        </>
      )}
      <a href={url + "/observations/latest"} target="_blank" rel="noreferrer">
        Registro original NWS ↗
      </a>
    </div>
  );
}
