import { test } from "node:test";
import assert from "node:assert/strict";
import {
  watchDeviceLocation,
  locationOptions,
  locationErrorMessage,
} from "../src/services/geolocation.mjs";
function setup() {
  let receive, fail, visibility;
  const cleared = [];
  let starts = 0;
  const page = {
    visibilityState: "visible",
    addEventListener: (_, cb) => (visibility = cb),
    removeEventListener: (_, cb) => {
      if (visibility === cb) visibility = null;
    },
  };
  const geo = {
    watchPosition: (success, error, options) => {
      receive = success;
      fail = error;
      assert.deepEqual(options, locationOptions);
      return ++starts;
    },
    clearWatch: (id) => cleared.push(id),
  };
  return {
    geo,
    page,
    cleared,
    receive: (p) => receive(p),
    fail: (e) => fail(e),
    hide: () => {
      page.visibilityState = "hidden";
      visibility();
    },
    show: () => {
      page.visibilityState = "visible";
      visibility();
    },
    get starts() {
      return starts;
    },
  };
}
test("GPS delivers actual coordinates unchanged, with fresh high-accuracy requests", () => {
  const mock = setup(),
    points = [];
  const dispose = watchDeviceLocation(
    mock.geo,
    mock.page,
    (p) => points.push(p),
    () => {},
  );
  mock.receive({
    coords: { latitude: 18.451234, longitude: -66.081234, accuracy: 7 },
    timestamp: 123,
  });
  assert.deepEqual(points, [
    { lat: 18.451234, lon: -66.081234, accuracy: 7, timestamp: 123 },
  ]);
  assert.equal(locationOptions.enableHighAccuracy, true);
  assert.equal(locationOptions.maximumAge, 0);
  dispose();
  assert.deepEqual(mock.cleared, [1]);
});
test("permission, unavailable GPS and timeout have actionable distinct diagnostics", () => {
  const mock = setup(),
    messages = [];
  watchDeviceLocation(
    mock.geo,
    mock.page,
    () => {},
    (m) => messages.push(m),
  );
  for (const code of [1, 2, 3]) mock.fail({ code });
  assert.match(messages[1], /Permiso/);
  assert.match(messages[2], /no pudo determinar/);
  assert.match(messages[3], /tardó/);
  assert.notEqual(
    locationErrorMessage({ code: 1 }),
    locationErrorMessage({ code: 3 }),
  );
});
test("GPS watch pauses while hidden and is removed on cleanup; late coordinates are ignored", () => {
  const mock = setup(),
    points = [];
  const dispose = watchDeviceLocation(
    mock.geo,
    mock.page,
    (p) => points.push(p),
    () => {},
  );
  mock.hide();
  assert.deepEqual(mock.cleared, [1]);
  assert.equal(mock.starts, 1);
  mock.show();
  assert.equal(mock.starts, 2);
  dispose();
  assert.deepEqual(mock.cleared, [1, 2]);
  mock.receive({
    coords: { latitude: 4.65, longitude: -74.1, accuracy: 8 },
    timestamp: 123,
  });
  assert.equal(points.length, 0);
});
test("unavailable APIs and invalid GPS coordinates never create a false position", () => {
  const messages = [];
  assert.doesNotThrow(() =>
    watchDeviceLocation(
      null,
      {},
      () => {},
      (m) => messages.push(m),
    )(),
  );
  assert.match(messages[0], /no ofrece/);
  const mock = setup(),
    points = [];
  watchDeviceLocation(
    mock.geo,
    mock.page,
    (p) => points.push(p),
    (m) => messages.push(m),
  );
  mock.receive({ coords: { latitude: NaN, longitude: -74, accuracy: 10 } });
  assert.equal(points.length, 0);
  assert.match(messages.at(-1), /no válida/);
});
