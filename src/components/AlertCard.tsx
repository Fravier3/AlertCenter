import { useEffect, useState } from "react";
import {
  CloudFog,
  CloudLightning,
  Flame,
  Languages,
  Sailboat,
  Thermometer,
  Tornado,
  TriangleAlert,
  Waves,
  Wind,
} from "lucide-react";
import type { Feature } from "../types";
import { SourceLink } from "./UI";
import { eventEs, labelEs, paragraphs } from "../services/alertsEs.mjs";
import { toSpanish } from "../services/translate";

const icons: [RegExp, typeof Waves][] = [
  [/flood|surf|rip current|beach|surge|tsunami/i, Waves],
  [/hurricane|tropical|tornado/i, Tornado],
  [/thunder|severe/i, CloudLightning],
  [/small craft|marine|gale|seas/i, Sailboat],
  [/heat/i, Thermometer],
  [/wind/i, Wind],
  [/fire|red flag/i, Flame],
  [/fog|dust|air/i, CloudFog],
];
export const alertIcon = (event: string) =>
  icons.find(([re]) => re.test(event))?.[1] ?? TriangleAlert;

function useSpanish(blocks: string[]) {
  const key = blocks.join("\n\n");
  const [state, setState] = useState<{
    text: string[];
    status: "loading" | "done" | "failed";
  }>({ text: blocks, status: "loading" });
  useEffect(() => {
    let alive = true;
    setState({ text: blocks, status: "loading" });
    Promise.all(blocks.map(toSpanish))
      .then((text) => alive && setState({ text, status: "done" }))
      .catch(() => alive && setState({ text: blocks, status: "failed" }));
    return () => {
      alive = false;
    };
  }, [key]);
  return { ...state, translated: state.text.join("\n\n") !== key };
}

/** One official NWS alert, presented in Spanish with the original at hand. */
export default function AlertCard({
  alert,
  fmt,
}: {
  alert: Feature;
  fmt: (t: string) => string;
}) {
  const p = alert.properties;
  const body = paragraphs(p.description);
  const advice = paragraphs(p.instruction);
  const es = useSpanish([...body, ...advice]);
  const Icon = alertIcon(p.event);
  const chips = [
    labelEs("urgency", p.urgency),
    labelEs("certainty", p.certainty),
  ].filter(Boolean);
  return (
    <article className={"alert-item " + String(p.severity).toLowerCase()}>
      <div className="alert-title">
        <span className="alert-icon">
          <Icon size={22} />
        </span>
        <div>
          <span className="tag">
            OFICIAL · {labelEs("severity", p.severity) || "No especificada"}
          </span>
          <h3>{eventEs(p.event)}</h3>
        </div>
      </div>
      <p className="alert-area">{p.areaDesc}</p>
      {chips.length > 0 && (
        <div className="alert-chips">
          {chips.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
      )}
      <div
        className={"alert-body" + (es.status === "loading" ? " loading" : "")}
        aria-busy={es.status === "loading"}
      >
        {es.text.slice(0, body.length).map((t, i) => (
          <p key={i}>{t}</p>
        ))}
        {advice.length > 0 && (
          <div className="alert-advice">
            <strong>Qué hacer</strong>
            {es.text.slice(body.length).map((t, i) => (
              <p key={i}>{t}</p>
            ))}
          </div>
        )}
      </div>
      <p className="alert-translation">
        <Languages size={14} />
        {es.status === "loading"
          ? "Traduciendo al español…"
          : es.status === "failed"
            ? "No se pudo traducir ahora; se muestra el texto oficial en inglés."
            : es.translated
              ? "Traducción automática. El texto oficial es el original de NWS."
              : "Texto oficial de NWS."}
      </p>
      {es.translated && (
        <details>
          <summary>Ver texto original en inglés</summary>
          <p className="preline">{p.headline}</p>
          {[...body, ...advice].map((t, i) => (
            <p key={i}>{t}</p>
          ))}
        </details>
      )}
      <div className="alert-meta">
        <span>
          Emitida {fmt(p.sent)}
          <br />
          Vigente hasta {fmt(p.ends || p.expires)}
          <br />
          {p.senderName}
        </span>
        <SourceLink url={p["@id"] || p.id}>Fuente NWS</SourceLink>
      </div>
    </article>
  );
}
