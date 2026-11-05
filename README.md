# PR Alert Center

PWA gratuita para Puerto Rico, Bogotá y Cundinamarca. React + TypeScript + Vite, Leaflet, Recharts y un service worker generado con Workbox.

## Desarrollo

```sh
npm ci
npm test
npm run dev
npm run build
```

Node 22 o superior. `src/` contiene fuentes; `dist/` es el único directorio publicado por GitHub Actions. No se requieren claves, cuentas de usuario, servicios de pago ni Supabase. No incluye anuncios ni suscripciones. El uso de Open-Meteo es no comercial y está sujeto a su política de uso gratuito.

## Funciones

- Selectores para 78 municipios de Puerto Rico; Bogotá D.C., 116 municipios de Cundinamarca y 20 localidades de Bogotá.
- Condiciones meteorológicas estimadas, pronóstico horario y de siete días, gráficos y calidad del aire CAMS.
- Alertas NWS activas para toda la isla, con severidad, vigencia, descripción y enlace al origen. Se descartan cancelaciones, pruebas y registros vencidos.
- Sismos USGS de los últimos siete días con magnitud, profundidad, coordenadas, distancia, filtros, mapa y cronología. No se presentan como predicción ni alerta temprana.
- Mapas CARTO / OpenStreetMap, marcadores de ubicación, epicentros, polígonos de alertas cuando existen, puntos meteorológicos de modelo y hasta 100 ubicaciones de estaciones NWS. Cada estación permite consultar su última observación NWS, con fecha y aviso si tiene más de una hora; los campos ausentes se identifican.
- Favoritos, °C/°F, apariencia clara/oscura, región persistente y geolocalización opcional para seleccionar el punto más cercano.
- PWA instalable, interfaz con áreas seguras, caché fechada y actualización controlada del service worker.

## Fuentes y límites verificados

| Datos | Fuente | Naturaleza y actualización |
| --- | --- | --- |
| Clima | https://open-meteo.com/en/docs | Modelo y pronóstico. Caché 10 min por ubicación. No observación instrumental. |
| Aire | https://open-meteo.com/en/docs/air-quality-api | Modelo CAMS / US AQI. Caché 30 min. Polvo mineral no confirma origen sahariano. |
| Alertas PR | https://api.weather.gov/alerts/active?area=PR | Alertas oficiales. Caché 2 min. Texto original NWS. |
| Sismos | https://earthquake.usgs.gov/fdsnws/event/1/ | Registros oficiales USGS. Caché 5 min por región. |
| Estaciones PR | https://api.weather.gov/stations?state=PR&limit=100 | Ubicaciones de estaciones (caché 24 h); observaciones bajo demanda (caché 10 min). |
| Municipios PR | https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_counties_national.zip | US Census Gazetteer 2025, centros representativos. |
| Municipios CO | https://www.datos.gov.co/resource/gdxc-w37w.json | Datos Abiertos Colombia, DIVIPOLA. Bogotá y departamento 25. |
| Localidades Bogotá | https://www.ideca.gov.co/ | Nombres y puntos representativos aproximados, sin polígonos oficiales. |

**Colombia:** el servicio ArcGIS de IDEAM `OSPA/Alertas_Nacional/MapServer/0` respondió, pero sus registros consultados tenían fecha de 2022. Por eso no se incorpora como feed vigente. IDEAM, IDIGER, UNGRD, RMCAB y SGC aparecen como enlaces de consulta externa explícitamente identificados. SGC no proporcionó un feed automatizado accesible en la comprobación; USGS sirve ambas regiones. NHC y la Red Sísmica de Puerto Rico se ofrecen como fuentes oficiales externas, sin simular integración en vivo.

La capa Radar de lluvia es una secuencia observada; no hay interpolación meteorológica artificial ni radar futuro. Las capas de temperatura, lluvia y viento consultan un máximo de 12 puntos representativos, con caché de 30 min; se solicitan solo al abrir esas capas. No se mantiene vigilancia con la aplicación cerrada. Los avisos opcionales requieren permiso explícito, service worker y navegador compatible; se evalúan con la app visible cada cinco minutos. No hay infraestructura push de servidor.

## Resiliencia, privacidad y rendimiento

Las fuentes se consultan desde el navegador por HTTPS. Preferencias y respuestas públicas se guardan localmente; nunca credenciales. Se usa timeout, deduplicación de peticiones, caché por ubicación y región, validación básica de respuestas, reintento y fallback claramente identificado. Ningún fallo se convierte en una alerta o en un valor inventado. La geolocalización no se transmite directamente: se elige localmente la ubicación representativa más cercana y se consulta esa coordenada pública.

Las rutas de recursos y manifest usan `/AlertCenter/`. La navegación usa hash para admitir recargas en Pages sin servidor SPA. Workbox precarga el build coherente y limpia exclusivamente su caché obsoleta. Las respuestas de APIs se guardan con fecha en almacenamiento local. La interfaz informa errores por fuente y datos recuperados de caché.

Los módulos de mapa y gráficas se cargan por separado. La compilación minifica y no publica mapas de fuentes, tests, documentación ni dependencias de desarrollo.

## Validación

`npm test` verifica cobertura geográfica, ajustes corruptos, conversión de temperatura, zonas horarias, exclusión de alertas vencidas o de prueba, umbrales US AQI, distancias, agrupación por día local, deduplicación, caché, fallos de API y almacenamiento bloqueado. `npm run build` incluye verificación TypeScript y generación PWA.

Las comprobaciones visuales en navegador cubren escritorio y un viewport móvil con insets simulados. Instalación y comportamiento físico de iOS/Android requieren verificación en dispositivos reales; no se confunden con emulación.

## Radar de lluvia (v1.0.5)

La capa Radar de lluvia utiliza RainViewer Weather Maps API, gratuita sin clave para uso personal/no comercial. Muestra hasta 13 mosaicos observados de las últimas dos horas, con control de reproducción/pausa y fecha local. El manifiesto se guarda por cinco minutos; solo se consulta al activar la capa. La animación avanza cada ocho segundos y se pausa al ocultar la página para reducir solicitudes. Las teselas se limitan a la región seleccionada y a la resolución nativa máxima 7.

La máscara del proveedor sombrea zonas sin cobertura. También se comprueba el píxel del centro representativo de la ubicación seleccionada; no se extrapola esa comprobación a todo el municipio. Si no puede leerse la máscara o falla una imagen, se avisa explícitamente. En la comprobación inicial San Juan tenía cobertura y Bogotá no; esto no garantiza la disponibilidad futura. Un mapa vacío no se presenta como ausencia de lluvia. La máscara del proveedor puede estar desactualizada.

Esta API no proporciona radar futuro desde enero de 2026. El botón Ver pronóstico lleva al modelo horario de Open-Meteo, identificado por separado; no se inventa una trayectoria futura. Atribución visible Weather data by RainViewer. Fuentes: https://www.rainviewer.com/api/weather-maps-api.html y https://www.rainviewer.com/api/transition-faq.html .
