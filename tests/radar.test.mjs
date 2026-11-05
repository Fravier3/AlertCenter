import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeRadarManifest,
  radarTiles,
  coverageTiles,
  coveragePoint,
  radarFrameLabel,
} from "../src/services/radar.mjs";
const now = Date.parse("2026-11-05T16:00Z");
const time = Math.floor(now / 1000) - 600;
const manifest = {
  host: "https://tilecache.rainviewer.com",
  radar: {
    past: [{ time, path: "/v2/radar/abc123" }],
    nowcast: [{ time: time + 3600, path: "/v2/radar/future" }],
  },
};
test("only observed radar frames are shown; future frames and invalid records are discarded", () => {
  const d = normalizeRadarManifest(
    {
      ...manifest,
      radar: {
        ...manifest.radar,
        past: [
          ...manifest.radar.past,
          { time: time + 3600, path: "/v2/radar/future" },
          { time, path: "/bad" },
          { time: null, path: "/v2/radar/null" },
        ],
      },
    },
    now,
  );
  assert.deepEqual(d.frames, manifest.radar.past);
  assert(!radarTiles(d.host, d.frames[0]).includes("future"));
});
test("radar frame URLs must stay on the trusted HTTPS provider", () => {
  for (const host of [
    "http://tilecache.rainviewer.com",
    "https://evil.example",
    "https://tilecache.rainviewer.com.evil.example",
    "https://secret@tilecache.rainviewer.com",
  ])
    assert.throws(
      () => normalizeRadarManifest({ ...manifest, host }, now),
      /Origen/,
    );
  assert.throws(
    () =>
      normalizeRadarManifest({ host: manifest.host, radar: { past: [] } }, now),
    /Sin imágenes/,
  );
});
test("timeline keeps at most 13 unique chronological frames and preserves their returned paths", () => {
  const frames = Array.from({ length: 20 }, (_, i) => ({
    time: time - i * 600,
    path: "/v2/radar/frame" + i,
  }));
  const d = normalizeRadarManifest(
    { ...manifest, radar: { past: [...frames, frames[0]] } },
    now,
  );
  assert.equal(d.frames.length, 13);
  assert.equal(d.frames.at(-1).time, time);
  assert.equal(d.frames.at(-1).path, "/v2/radar/frame0");
  assert(d.frames.every((f, i) => i === 0 || f.time > d.frames[i - 1].time));
});
test("coverage is a separate mask and dates follow the selected regional time zone", () => {
  assert(coverageTiles(manifest.host).includes("/v2/coverage/0/"));
  assert(
    coveragePoint(manifest.host, 18.42, -66.07).includes("18.4200/-66.0700"),
  );
  assert(radarFrameLabel(time, "America/Puerto_Rico", now).includes("11:50"));
  assert(radarFrameLabel(time, "America/Bogota", now).includes("10:50"));
  assert(
    radarFrameLabel(time - 3600, "America/Puerto_Rico", now).includes(
      "histórica",
    ),
  );
});
