import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight } from "lucide-react";
import type { Feature, Place } from "../types";
import { Jelly, epicenter, magTone } from "./UI";
import { distance } from "../services/domain.mjs";

type SortKey = "time" | "mag";
const PAGE = 25;

/** Earthquake records: epicentre, local day and time, magnitude. */
export default function QuakeTable({
  quakes,
  zone,
  place,
  empty,
}: {
  quakes: Feature[];
  zone: string;
  place: Place;
  empty: string;
}) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "time",
    desc: true,
  });
  const [shown, setShown] = useState(PAGE);
  const rows = useMemo(
    () =>
      [...quakes].sort(
        (a, b) =>
          (a.properties[sort.key] - b.properties[sort.key]) *
          (sort.desc ? -1 : 1),
      ),
    [quakes, sort],
  );
  const heading = (key: SortKey, label: string, short = label) => (
    <th
      aria-sort={
        sort.key !== key ? "none" : sort.desc ? "descending" : "ascending"
      }
    >
      <button
        className="th-sort"
        onClick={() =>
          setSort((s) => ({ key, desc: s.key === key ? !s.desc : true }))
        }
      >
        <span className="wide-only">{label}</span>
        <span className="narrow-only">{short}</span>
        {sort.key === key &&
          (sort.desc ? <ArrowDown size={13} /> : <ArrowUp size={13} />)}
      </button>
    </th>
  );
  if (!rows.length) return <div className="empty">{empty}</div>;
  return (
    <>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {heading("mag", "Magnitud", "Mag.")}
              <th>Epicentro</th>
              {heading("time", "Día")}
              
              <th className="wide-only">Hora</th>
              <th className="wide-only">Profundidad</th>
              <th className="wide-only">Distancia</th>
              <th className="wide-only" aria-label="Fuente" />
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, shown).map((f) => {
              const [lon, lat, depth] = f.geometry.coordinates;
              const when = new Date(f.properties.time);
              const km = Math.round(distance(place.lat, place.lon, lat, lon));
              const hour = when.toLocaleTimeString("es-PR", {
                timeZone: zone,
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <tr key={String(f.id)}>
                  <td>
                    <span className={"mag-chip " + magTone(f.properties.mag)}>
                      {f.properties.mag.toFixed(1)}
                    </span>
                  </td>
                  <td>
                    <strong>
                      <a
                        href={f.properties.url}
                        target="_blank"
                        rel="noreferrer"
                        title="Ver el registro en USGS"
                      >
                        {epicenter(f.properties.place)}
                      </a>
                    </strong>
                    <small className="narrow-only">
                      {depth.toFixed(1)} km prof. · a {km} km
                    </small>
                  </td>
                  <td className="nowrap capitalize">
                    {when.toLocaleDateString("es-PR", {
                      timeZone: zone,
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                    <small className="narrow-only numeric">{hour}</small>
                  </td>
                  <td className="wide-only nowrap numeric">{hour}</td>
                  <td className="wide-only numeric">{depth.toFixed(1)} km</td>
                  <td className="wide-only numeric">{km} km</td>
                  <td className="wide-only">
                    <a
                      className="row-link"
                      href={f.properties.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={
                        "Ver en USGS: " + epicenter(f.properties.place)
                      }
                    >
                      <ArrowUpRight size={16} />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="table-foot">
        <small>
          {Math.min(shown, rows.length)} de {rows.length} sismos · distancia
          desde {place.name}
        </small>
        {shown < rows.length && (
          <Jelly onClick={() => setShown((n) => n + PAGE)}>Mostrar más</Jelly>
        )}
      </div>
    </>
  );
}
