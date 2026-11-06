import { useEffect, useRef, useState } from "react";
import { divIcon } from "leaflet";
import { Marker, Polyline, Popup, useMap } from "react-leaflet";
import { watchDeviceLocation } from "../services/geolocation.mjs";
type Point = { lat: number; lon: number; accuracy: number; timestamp: number };
const deviceIcon = divIcon({
  className: "device-location-pin",
  html: "<b>TÚ</b><span></span>",
  iconSize: [42, 42],
  iconAnchor: [21, 42],
  popupAnchor: [0, -42],
});
export default function DeviceLocation({
  active,
  attempt,
  onStatus,
}: {
  active: boolean;
  attempt: number;
  onStatus: (s: string) => void;
}) {
  const map = useMap();
  const [point, setPoint] = useState<Point | null>(null);
  const [trail, setTrail] = useState<[number, number][]>([]);
  const centered = useRef(false);
  useEffect(() => {
    setPoint(null);
    setTrail([]);
    centered.current = false;
    if (!active) return;
    return watchDeviceLocation(
      navigator.geolocation,
      document,
      (p: Point) => {
        setPoint(p);
        setTrail((old) => [...old.slice(-199), [p.lat, p.lon]]);
        if (!centered.current) {
          map.setView(
            [p.lat, p.lon],
            p.accuracy <= 100 ? 16 : p.accuracy <= 1000 ? 14 : 11,
          );
          centered.current = true;
        } else map.panTo([p.lat, p.lon]);
      },
      onStatus,
    );
  }, [active, attempt, map, onStatus]);
  return active && point ? (
    <>
      <Polyline
        positions={trail}
        pathOptions={{ color: "#177df0", weight: 3 }}
      />
      <Marker
        position={[point.lat, point.lon]}
        icon={deviceIcon}
        title="Tu ubicación GPS real"
        alt="Tu ubicación GPS real"
      >
        <Popup>
          <strong>Tu dispositivo · posición GPS</strong>
          <p>
            Precisión aproximada: {Math.round(point.accuracy)} m<br />
            Recibida: {new Date(point.timestamp).toLocaleTimeString("es-PR")}
          </p>
          <p>El clima sigue correspondiendo al municipio que seleccionaste.</p>
        </Popup>
      </Marker>
    </>
  ) : null;
}
