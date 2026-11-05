export default function WeatherSky({ current }: { current?: { weather_code?: number; is_day?: number } }) {
  const code = current?.weather_code;
  const night = current?.is_day === 0;
  const rain = code != null && code >= 51;
  const cloudy = code != null && code >= 2;
  return <div aria-hidden="true" className={`weather-sky ${night ? "sky-night" : "sky-day"} ${cloudy ? "sky-cloudy" : ""} ${rain ? "sky-rain" : ""}`}>
    <i className="sky-orb" /><i className="sky-cloud cloud-one" /><i className="sky-cloud cloud-two" /><i className="sky-cloud cloud-three" />
    {rain && <div className="sky-drops" />}
  </div>;
}
