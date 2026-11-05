import { CloudRain, Wind, Thermometer, Info } from "lucide-react";
import type { Weather } from "../types";
export default function ModelSignals({ weather }: { weather?: Weather }) {
  const signals = [
    {
      name: "Lluvia prevista hoy",
      value: weather?.daily.precipitation_sum[0],
      unit: "mm",
      threshold: 20,
      icon: CloudRain,
    },
    {
      name: "Ráfagas del modelo actual",
      value: weather?.current.wind_gusts_10m,
      unit: "km/h",
      threshold: 50,
      icon: Wind,
    },
    {
      name: "Sensación térmica actual",
      value: weather?.current.apparent_temperature,
      unit: "°C",
      threshold: 38,
      icon: Thermometer,
    },
  ];
  return (
    <section className="panel model-signals">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">
            RIESGO ESTIMADO · NO ES UNA ALERTA OFICIAL
          </span>
          <h2>Señales del modelo</h2>
        </div>
        <Info size={19} className="cyan" />
      </div>
      <div className="signal-grid">
        {signals.map((s) => (
          <div key={s.name}>
            <s.icon
              size={20}
              className={s.value >= s.threshold ? "amber" : "cyan"}
            />
            <div>
              <small>{s.name}</small>
              <strong>
                {s.value ?? "—"} {s.unit}
              </strong>
              <span className={s.value >= s.threshold ? "amber" : ""}>
                {s.value == null
                  ? "Sin datos"
                  : s.value >= s.threshold
                    ? "Umbral orientativo alcanzado"
                    : "Por debajo del umbral orientativo"}
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="source-caption">
        Referencias propias de esta app: lluvia ≥ 20 mm/día, ráfagas ≥ 50 km/h,
        sensación ≥ 38 °C. No equivalen a los criterios de NWS o IDEAM ni
        descartan riesgos por debajo de esos valores.
      </p>
    </section>
  );
}
