import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  distance,
  temp,
  aqiCategory,
  modelTime,
  activeAlerts,
  dailyQuakes,
  safeSettings,
  zones,
} from "../src/services/domain.mjs";
const places = JSON.parse(
  fs.readFileSync(new URL("../src/data/places.json", import.meta.url)),
);
test("geography covers all intended administrative units without duplicate IDs", () => {
  assert.equal(places.filter((p) => p.region === "pr").length, 78);
  assert.equal(
    places.filter((p) => p.region === "co" && p.kind === "Municipio").length,
    116,
  );
  assert.equal(places.filter((p) => p.id.startsWith("bog-")).length, 20);
  assert.equal(new Set(places.map((p) => p.id)).size, places.length);
  for (const p of places) {
    assert(Number.isFinite(p.lat) && Number.isFinite(p.lon));
    assert(
      p.region === "pr" ? p.lat >= 17 && p.lat < 19 : p.lat >= 3 && p.lat < 6.5,
    );
  }
});
test("regional defaults and persisted settings are validated", () => {
  assert.equal(safeSettings(null, places).placeId, "72127");
  assert.equal(
    safeSettings(
      {
        placeId: "bog-01",
        region: "pr",
        mag: 99,
        theme: "invalid",
        favorites: ["bog-01", "invalid"],
      },
      places,
    ).region,
    "co",
  );
  assert.equal(safeSettings({ mag: 99 }, places).mag, 7);
  assert.deepEqual(
    safeSettings({ favorites: ["bog-01", "invalid"] }, places).favorites,
    ["bog-01"],
  );
  assert.equal(safeSettings({ placeId: "invalid" }, places).placeId, "72127");
});
test("converts temperatures and handles missing values", () => {
  assert.equal(temp(0, "f"), 32);
  assert.equal(temp(30, "c"), 30);
  assert.equal(temp(null), "—");
  assert.equal(temp(NaN), "—");
});
test("local model timestamps remain correct in both time zones", () => {
  assert.equal(
    new Date(modelTime("2026-11-05T08:00", -14400)).toISOString(),
    "2026-11-05T12:00:00.000Z",
  );
  assert.equal(
    new Date(modelTime("2026-11-05T08:00", -18000)).toISOString(),
    "2026-11-05T13:00:00.000Z",
  );
});
test("official alerts exclude expired, future, test and canceled records", () => {
  const now = Date.parse("2026-11-05T12:00Z");
  const good = {
    properties: {
      status: "Actual",
      expires: "2026-11-05T13:00Z",
      effective: "2026-11-05T11:00Z",
    },
  };
  assert.equal(
    activeAlerts(
      [
        good,
        { properties: { ...good.properties, expires: "2026-11-05T10:00Z" } },
        { properties: { ...good.properties, status: "Test" } },
        { properties: { ...good.properties, messageType: "Cancel" } },
        { properties: { ...good.properties, effective: "2026-11-05T14:00Z" } },
      ],
      now,
    ).length,
    1,
  );
});
test("air quality thresholds follow US AQI intervals", () => {
  assert.equal(aqiCategory(50).label, "Buena");
  assert.equal(aqiCategory(51).label, "Moderada");
  assert.equal(aqiCategory(101).label, "Dañina para sensibles");
  assert.equal(aqiCategory(201).label, "Muy dañina");
  assert.equal(aqiCategory(301).label, "Peligrosa");
  assert.equal(aqiCategory(null).label, "No disponible");
});
test("seismic distances and day grouping use selected region", () => {
  assert.equal(distance(18, -66, 18, -66), 0);
  assert(distance(18.4, -66.1, 18, -67) > 100);
  const now = Date.parse("2026-11-05T12:00Z");
  const events = [{ properties: { time: Date.parse("2026-11-05T04:30Z") } }];
  assert.equal(dailyQuakes(events, zones.pr, 1, now)[0].count, 1);
  assert.equal(dailyQuakes(events, zones.co, 1, now)[0].count, 0);
  assert.equal(dailyQuakes([], zones.pr, 7, now).length, 7);
});
test("temperature choices survive region switches and persisted reloads", () => {
  const places = [{id:"72127",region:"pr"},{id:"11001",region:"co"}];
  const initial = safeSettings(null, places);
  assert.deepEqual(initial.units, {pr:"f",co:"c"});
  const stored = JSON.parse(JSON.stringify({...initial, units:{pr:"f",co:"c"}, placeId:"11001"}));
  const co = safeSettings(stored, places);
  assert.equal(co.units.co,"c");
  const pr = safeSettings({...co,placeId:"72127"},places);
  assert.equal(pr.units.pr,"f");
  assert.equal(pr.units.co,"c");
  assert.deepEqual(safeSettings({unit:"f"},places).units,{pr:"f",co:"f"});
});
