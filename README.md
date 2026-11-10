# PR Alert Center

PWA gratuita para Puerto Rico, Bogotá y Cundinamarca. React + TypeScript + Vite, MapLibre GL, Motion, Recharts y un service worker generado con Workbox.

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
- Sismos USGS de los últimos siete días en una tabla ordenable (epicentro, día, hora local, magnitud, profundidad y distancia), con filtros y un mapa propio de epicentros. No se presentan como predicción ni alerta temprana.
- Mapa de monitoreo dedicado al radar de lluvia observado, en repetición continua. Mapa base vectorial OpenFreeMap / OpenStreetMap sin clave, con CARTO como respaldo.
- Cada sección (Radar, Alertas, Sismos, Clima) es un visor independiente.
- Favoritos, °C/°F, apariencia clara/oscura, región persistente y geolocalización opcional para mostrar la posición real del dispositivo.
- PWA instalable, interfaz con áreas seguras, caché fechada y actualización controlada del service worker.

## Fuentes y límites verificados

| Datos | Fuente | Naturaleza y actualización |
| --- | --- | --- |
| Clima | https://open-meteo.com/en/docs | Modelo y pronóstico. Caché 10 min por ubicación. No observación instrumental. |
| Aire | https://open-meteo.com/en/docs/air-quality-api | Modelo CAMS / US AQI. Caché 30 min. Polvo mineral no confirma origen sahariano. |
| Alertas PR | https://api.weather.gov/alerts/active?area=PR | Alertas oficiales. Caché 2 min. Texto original NWS. |
| Sismos | https://earthquake.usgs.gov/fdsnws/event/1/ | Registros oficiales USGS. Caché 5 min por región. |
| Radar | https://www.rainviewer.com/api/weather-maps-api.html | Mosaicos observados de las últimas dos horas. Manifiesto en caché 5 min. |
| Mapa base | https://openfreemap.org/ | Teselas vectoriales de OpenStreetMap, sin clave. |
| Municipios PR | https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_counties_national.zip | US Census Gazetteer 2025, centros representativos. |
| Municipios CO | https://www.datos.gov.co/resource/gdxc-w37w.json | Datos Abiertos Colombia, DIVIPOLA. Bogotá y departamento 25. |
| Localidades Bogotá | https://www.ideca.gov.co/ | Nombres y puntos representativos aproximados, sin polígonos oficiales. |

**Colombia:** el servicio ArcGIS de IDEAM `OSPA/Alertas_Nacional/MapServer/0` respondió, pero sus registros consultados tenían fecha de 2022. Por eso no se incorpora como feed vigente. IDEAM, IDIGER, UNGRD, RMCAB y SGC aparecen como enlaces de consulta externa explícitamente identificados. SGC no proporcionó un feed automatizado accesible en la comprobación; USGS sirve ambas regiones. NHC y la Red Sísmica de Puerto Rico se ofrecen como fuentes oficiales externas, sin simular integración en vivo.

El radar de lluvia es una secuencia observada; no hay interpolación meteorológica artificial ni radar futuro. No se mantiene vigilancia con la aplicación cerrada. Los avisos opcionales requieren permiso explícito, service worker y navegador compatible; se evalúan con la app visible cada cinco minutos. No hay infraestructura push de servidor.

## Resiliencia, privacidad y rendimiento

Las fuentes se consultan desde el navegador por HTTPS. Preferencias y respuestas públicas se guardan localmente; nunca credenciales. Se usa timeout, deduplicación de peticiones, caché por ubicación y región, validación básica de respuestas, reintento y fallback claramente identificado. Ningún fallo se convierte en una alerta o en un valor inventado. La posición GPS se mantiene solo en memoria. El mapa base solicita teselas del área visible; los datos meteorológicos usan las coordenadas públicas del municipio seleccionado.

Las rutas de recursos y manifest usan `/AlertCenter/`. La navegación usa hash para admitir recargas en Pages sin servidor SPA. Workbox precarga el build coherente y limpia exclusivamente su caché obsoleta. Las respuestas de APIs se guardan con fecha en almacenamiento local. La interfaz informa errores por fuente y datos recuperados de caché.

Los módulos de mapa y gráficas se cargan por separado. La compilación minifica y no publica mapas de fuentes, tests, documentación ni dependencias de desarrollo.

## Validación

`npm test` verifica cobertura geográfica, ajustes corruptos, conversión de temperatura, zonas horarias, exclusión de alertas vencidas o de prueba, umbrales US AQI, distancias, agrupación por día local, deduplicación, caché, fallos de API y almacenamiento bloqueado. `npm run build` incluye verificación TypeScript y generación PWA.

Las comprobaciones visuales en navegador cubren escritorio y un viewport móvil con insets simulados. Instalación y comportamiento físico de iOS/Android requieren verificación en dispositivos reales; no se confunden con emulación.

## Radar de lluvia (v1.0.5)

La capa Radar de lluvia utiliza RainViewer Weather Maps API, gratuita sin clave para uso personal/no comercial. Muestra hasta 13 mosaicos observados de las últimas dos horas, con control de reproducción/pausa y fecha local. El manifiesto se guarda por cinco minutos; solo se consulta al activar la capa. La animación precarga la secuencia, avanza cada 200 ms y se pausa al ocultar la página para reducir solicitudes. Las teselas se limitan a la región seleccionada y a la resolución nativa máxima 7.

La máscara del proveedor sombrea zonas sin cobertura. También se comprueba el píxel del centro representativo de la ubicación seleccionada; no se extrapola esa comprobación a todo el municipio. Si no puede leerse la máscara o falla una imagen, se avisa explícitamente. En la comprobación inicial San Juan tenía cobertura y Bogotá no; esto no garantiza la disponibilidad futura. Un mapa vacío no se presenta como ausencia de lluvia. La máscara del proveedor puede estar desactualizada.

Esta API no proporciona radar futuro desde enero de 2026. El botón Ver pronóstico lleva al modelo horario de Open-Meteo, identificado por separado; no se inventa una trayectoria futura. Atribución visible Weather data by RainViewer. Fuentes: https://www.rainviewer.com/api/weather-maps-api.html y https://www.rainviewer.com/api/transition-faq.html .

## Ubicación real (v1.0.6)

Se elimina el marcador circular del centro del municipio. El botón superior Mostrar mi ubicación GPS real abre el mapa e inicia el mismo seguimiento explícito que Seguir mi ubicación. Se dibujan las coordenadas recibidas del dispositivo con una etiqueta TÚ y sin círculo de precisión que pueda confundirse con sismos. El municipio seleccionado sigue determinando el clima; no sustituye la posición del GPS ni se impide mostrar ubicaciones fuera de la región.

Se solicita alta precisión, sin reutilizar posiciones antiguas, con timeout de 25 segundos. La primera posición centra y amplía el mapa; las siguientes siguen el movimiento. El recorrido es temporal, se borra al detener o salir del mapa, y el seguimiento se pausa con la app oculta. Se distinguen permiso denegado, GPS no disponible y timeout, con ayuda para iPhone y reintento. No es posible verificar o cambiar remotamente los permisos del teléfono del usuario.

La capa de radar inicia automáticamente al seleccionarla o volver a ella (v1.0.7), desde el primer fotograma. Conserva pausa manual y reinicia al reintentar. El avance sigue cada ocho segundos para limitar solicitudes; la interfaz muestra ese intervalo.

En v1.0.8 el loop avanza cada 200 ms tras precargar los fotogramas del área visible. Se mantienen las capas montadas y se alterna su opacidad; no se recrean ni descargan las mismas teselas en cada vuelta. El estado muestra el progreso de precarga y espera a que todas las imágenes estén listas. Las solicitudes siguen limitadas a la región y al zoom nativo 7.

## Rediseño y radar permanente (v1.1.0)

- Interfaz de cristal con fondo de aurora, botones con brillo y rebote elástico (Motion), navegación con indicador deslizante y tablas de bordes suavizados. Tema claro y oscuro; se respeta `prefers-reduced-motion`.
- El mapa pasa de Leaflet a MapLibre GL con el estilo vectorial de OpenFreeMap (`fiord` en oscuro, `positron` en claro). Si el estilo no carga, se usa un mapa ráster de CARTO.
- El mapa de monitoreo muestra únicamente el radar. La animación arranca sola, no tiene pausa, se detiene un instante en la imagen más reciente y solo se suspende con la página oculta. Espera a que la siguiente imagen esté cargada en lugar de mostrar un fotograma vacío.
- Se retiran del mapa las capas de sismos, ubicaciones, polígonos de alertas, puntos del modelo (temperatura, lluvia, viento) y estaciones NWS, junto con el recorrido GPS. Los sismos tienen su propio mapa en Sismos; el marcador TÚ sigue disponible en el radar.
- En Sismos, la lista y la cronología combinada se sustituyen por la tabla.

Las secciones anteriores sobre capas del mapa, pausa manual y recorrido GPS describen versiones previas.
