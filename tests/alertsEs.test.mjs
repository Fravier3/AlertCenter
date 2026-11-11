import test from "node:test";
import assert from "node:assert/strict";
import {
  eventEs,
  labelEs,
  paragraphs,
  looksSpanish,
  chunks,
} from "../src/services/alertsEs.mjs";

test("event names follow the NWS Spanish convention", () => {
  assert.equal(eventEs("Flood Advisory"), "Advertencia de inundaciones");
  assert.equal(
    eventEs("Flash Flood Warning"),
    "Aviso de inundaciones repentinas",
  );
  assert.equal(eventEs("Hurricane Watch"), "Vigilancia de huracán");
  assert.equal(
    eventEs("Rip Current Statement"),
    "Comunicado de corrientes marinas",
  );
});
test("unknown events keep the official name instead of a guess", () => {
  assert.equal(eventEs("Volcano Warning"), "Volcano Warning");
  assert.equal(eventEs(undefined), "Alerta");
  assert.equal(labelEs("severity", "Severe"), "Severa");
  assert.equal(labelEs("urgency", "Nope"), "");
});
test("hard-wrapped NWS text becomes paragraphs", () => {
  assert.deepEqual(paragraphs("* WHAT...Flooding\nis expected.\n\n* WHERE...Ponce."), [
    "* WHAT...Flooding is expected.",
    "* WHERE...Ponce.",
  ]);
  assert.deepEqual(paragraphs(null), []);
});
test("Spanish text is not sent to be translated again", () => {
  assert(looksSpanish("Se esperan inundaciones en las carreteras de la zona."));
  assert(!looksSpanish("Flooding of roads and low lying areas is expected."));
});
test("chunks respect the size limit and keep all the text", () => {
  const text = "One sentence here. ".repeat(60) + "x".repeat(1000);
  const parts = chunks(text, 450);
  assert(parts.every((p) => p.length <= 450));
  assert.equal(parts.join(" ").replace(/\s+/g, ""), text.replace(/\s+/g, ""));
});
