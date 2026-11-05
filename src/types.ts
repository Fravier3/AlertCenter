export type Region = "pr" | "co";
export type Place = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  region: Region;
  kind?: string;
};
export type Feature = {
  id?: string | number;
  type: string;
  geometry: any;
  properties: any;
};
export type Result<T> = { data: T; at: number; cached: boolean };
export type Settings = {
  region: Region;
  placeId: string;
  theme: "dark" | "light";
  unit: "c" | "f";
  mag: number;
  favorites: string[];
  showAlerts: boolean;
  notify: boolean;
};
export type Weather = {
  current: any;
  hourly: any;
  daily: any;
  utc_offset_seconds: number;
  timezone: string;
};
export type Air = { current: any; hourly: any; utc_offset_seconds: number };
