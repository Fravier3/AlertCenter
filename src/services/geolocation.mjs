export const locationOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 25000,
};
export function locationErrorMessage(error) {
  if (error?.code === 1)
    return "Permiso de ubicación denegado. En iPhone revisa Localización, Ubicación precisa y el permiso de este sitio en Safari. Después toca Reintentar ubicación.";
  if (error?.code === 2)
    return "El dispositivo no pudo determinar tu posición. Comprueba Localización, la señal y la conexión; luego reintenta. No se ha sustituido por el centro de un municipio.";
  if (error?.code === 3)
    return "El GPS tardó demasiado en responder. Intenta cerca de una ventana o al aire libre y toca Reintentar ubicación.";
  return "No se pudo obtener la ubicación del dispositivo. Revisa los permisos y reintenta.";
}
export function watchDeviceLocation(geo, page, onPosition, onStatus) {
  if (!geo) {
    onStatus(
      "Este navegador no ofrece geolocalización. Prueba abrir la app en Safari.",
    );
    return () => {};
  }
  let watch = null,
    disposed = false;
  const clear = () => {
    if (watch !== null) geo.clearWatch(watch);
    watch = null;
  };
  const sync = () => {
    clear();
    if (page.visibilityState !== "visible") {
      onStatus("Seguimiento pausado mientras la aplicación está oculta.");
      return;
    }
    onStatus(
      "Solicitando la posición real del dispositivo. Acepta el permiso de ubicación si aparece.",
    );
    watch = geo.watchPosition(
      (pos) => {
        if (disposed || page.visibilityState !== "visible") return;
        const { latitude: lat, longitude: lon, accuracy } = pos.coords;
        if (
          ![lat, lon, accuracy].every(Number.isFinite) ||
          Math.abs(lat) > 90 ||
          Math.abs(lon) > 180 ||
          accuracy < 0
        ) {
          onStatus(
            "El teléfono devolvió una posición no válida. Reintenta la ubicación.",
          );
          return;
        }
        onPosition({ lat, lon, accuracy, timestamp: pos.timestamp });
        onStatus(
          `Ubicación GPS recibida · margen de precisión aproximado ${Math.round(accuracy)} m${accuracy > 100 ? " · posición poco precisa: comprueba Ubicación precisa en el iPhone" : ""}.`,
        );
      },
      (error) => {
        if (!disposed) onStatus(locationErrorMessage(error));
      },
      locationOptions,
    );
  };
  sync();
  page.addEventListener("visibilitychange", sync);
  return () => {
    disposed = true;
    clear();
    page.removeEventListener("visibilitychange", sync);
  };
}
