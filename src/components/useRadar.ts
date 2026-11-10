import { useEffect, useState } from "react";
import type { Place, Result } from "../types";
import { cached } from "../services/api";
import { normalizeRadarManifest, coveragePoint } from "../services/radar.mjs";

type Manifest = ReturnType<typeof normalizeRadarManifest>;

/** Observed radar manifest (refreshed every 5 min) and coverage at the place. */
export function useRadar(place: Place) {
  const [result, setResult] = useState<Result<Manifest> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [coverage, setCoverage] = useState<"yes" | "no" | "unknown">("unknown");
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    cached<any>(
      "radar:manifest",
      "https://api.rainviewer.com/public/weather-maps.json",
      300000,
      (x) => {
        try {
          normalizeRadarManifest(x);
          return true;
        } catch {
          return false;
        }
      },
    )
      .then((r) => {
        if (alive) setResult({ ...r, data: normalizeRadarManifest(r.data) });
      })
      .catch(() => {
        if (alive) setError("No se pudo consultar el radar.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine)
        setAttempt((x) => x + 1);
    }, 300000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [attempt]);
  const host = result?.data.host;
  useEffect(() => {
    if (!host) return;
    let alive = true;
    setCoverage("unknown");
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timeout = setTimeout(() => {
      img.src = "";
    }, 12000);
    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw Error();
        ctx.drawImage(img, 128, 128, 1, 1, 0, 0, 1, 1);
        const alpha = ctx.getImageData(0, 0, 1, 1).data[3];
        if (alive) setCoverage(alpha < 128 ? "yes" : "no");
      } catch {
        if (alive) setCoverage("unknown");
      }
    };
    img.onerror = () => clearTimeout(timeout);
    img.src = coveragePoint(host, place.lat, place.lon);
    return () => {
      alive = false;
      clearTimeout(timeout);
      img.onload = null;
      img.onerror = null;
    };
  }, [host, place.id]);
  return {
    result,
    loading,
    error,
    coverage,
    retry: () => setAttempt((x) => x + 1),
  };
}
