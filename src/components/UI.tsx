import {
  CloudSun,
  CloudRain,
  CloudLightning,
  Cloud,
  CloudFog,
  Sun,
  Moon,
  ExternalLink,
} from "lucide-react";
import { motion, type HTMLMotionProps } from "motion/react";
import type { Result } from "../types";
/** Glass button with a springy, jelly-like press. */
export function Jelly(props: HTMLMotionProps<"button">) {
  return (
    <motion.button
      whileHover={{ scale: 1.04, y: -1 }}
      whileTap={{ scaleX: 1.07, scaleY: 0.88 }}
      transition={{ type: "spring", stiffness: 520, damping: 12, mass: 0.7 }}
      {...props}
    />
  );
}
export const magTone = (mag: number) =>
  mag >= 4.5 ? "high" : mag >= 3 ? "mid" : "low";
/** USGS describes epicentres in English ("5 km SSE of Guánica"). */
export const epicenter = (place: unknown) =>
  String(place ?? "Ubicación sin describir").replace(
    /^(\d+(?:\.\d+)?) km ([NSEW]{1,3}) of /,
    (_, km, dir) => `${km} km al ${dir.replace(/W/g, "O")} de `,
  );
export function WeatherIcon({
  code = 3,
  day = true,
  size = 32,
}: {
  code?: number;
  day?: boolean;
  size?: number;
}) {
  const Icon =
    code >= 95
      ? CloudLightning
      : code >= 51
        ? CloudRain
        : code >= 45
          ? CloudFog
          : code === 0
            ? day
              ? Sun
              : Moon
            : code <= 2
              ? CloudSun
              : Cloud;
  return <Icon size={size} strokeWidth={1.4} aria-hidden="true" />;
}
export function Stamp({
  result,
  zone,
  label = "Consultado",
}: {
  result?: Result<any> | null;
  zone: string;
  label?: string;
}) {
  if (!result) return null;
  const stale = result.cached || Date.now() - result.at > 1800000;
  return (
    <small className={stale ? "stamp stale" : "stamp"}>
      {stale ? "Datos guardados · " : ""}
      {label}{" "}
      {new Date(result.at).toLocaleString("es-PR", {
        timeZone: zone,
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}
    </small>
  );
}
export function SourceLink({
  url,
  children,
}: {
  url: string;
  children: React.ReactNode;
}) {
  return (
    <a href={url} target="_blank" rel="noreferrer">
      {children} <ExternalLink size={13} aria-hidden="true" />
    </a>
  );
}
export function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}
