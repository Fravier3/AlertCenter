import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = fs
  .readFileSync(new URL("../src/services/api.ts", import.meta.url), "utf8")
  .replace(
    /['"]\.\/domain\.mjs['"]/,
    JSON.stringify(new URL("../src/services/domain.mjs", import.meta.url).href),
  );
const js = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const api = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
const data = new Map();
globalThis.localStorage = {
  getItem: (k) => data.get(k) || null,
  setItem: (k, v) => data.set(k, v),
};
test("cache avoids duplicate requests, preserves region isolation and provides dated fallback", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 5));
    return { ok: true, json: async () => ({ features: [] }) };
  };
  const valid = (x) => Array.isArray(x.features);
  const first = await Promise.all([
    api.cached("pr", "https://example.invalid/pr", 10000, valid),
    api.cached("pr", "https://example.invalid/pr", 10000, valid),
  ]);
  assert.equal(calls, 1);
  assert.equal(first[0].at, first[1].at);
  await api.cached("pr", "https://example.invalid/pr", 10000, valid);
  assert.equal(calls, 1);
  await api.cached("co", "https://example.invalid/co", 10000, valid);
  assert.equal(calls, 2);
  const old = {
    data: { features: [{ id: "saved" }] },
    at: 1000,
    cached: false,
  };
  data.set("ac:data:pr", JSON.stringify(old));
  globalThis.fetch = async () => {
    throw Error("offline");
  };
  const fallback = await api.cached(
    "pr",
    "https://example.invalid/pr",
    1,
    valid,
  );
  assert.equal(fallback.cached, true);
  assert.equal(fallback.at, 1000);
  assert.equal(fallback.data.features[0].id, "saved");
  await assert.rejects(
    () => api.cached("missing", "https://example.invalid/missing", 1, valid),
    /offline/,
  );
});
test("invalid API data is rejected and never represented as a successful empty feed", async () => {
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ error: "unexpected" }),
  });
  await assert.rejects(
    () =>
      api.cached("bad", "https://example.invalid/bad", 1, (x) =>
        Array.isArray(x.features),
      ),
    /incompleta/,
  );
  assert.equal(data.has("ac:data:bad"), false);
});
test("blocked device storage does not crash preference reads or writes", () => {
  globalThis.localStorage = {
    getItem: () => {
      throw Error("blocked");
    },
    setItem: () => {
      throw Error("blocked");
    },
  };
  assert.equal(api.readStore("x"), null);
  assert.doesNotThrow(() => api.writeStore("x", { a: 1 }));
});
