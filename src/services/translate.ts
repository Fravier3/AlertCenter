import { readStore, writeStore } from "./api";
import { chunks, looksSpanish } from "./alertsEs.mjs";

const STORE = "ac:tr:v1";
const pending = new Map<string, Promise<string>>();
const json = async (url: string) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw Error(String(r.status));
  return r.json();
};
/** On-device translation where the browser offers it (no network). */
async function builtIn(text: string) {
  const api = (globalThis as any).Translator;
  const pair = { sourceLanguage: "en", targetLanguage: "es" };
  if (!api) throw Error();
  // Never let a slow or stuck browser API hold back the network services.
  const limit = new Promise<never>((_, no) => setTimeout(no, 2500));
  const work = (async () => {
    if ((await api.availability(pair)) !== "available") throw Error();
    return (await api.create(pair)).translate(text) as Promise<string>;
  })();
  return Promise.race([work, limit]);
}
async function myMemory(text: string) {
  const out: string[] = [];
  for (const part of chunks(text, 450)) {
    const r = await json(
      "https://api.mymemory.translated.net/get?langpair=en|es&q=" +
        encodeURIComponent(part),
    );
    const t = r?.responseData?.translatedText;
    if (r?.responseStatus !== 200 || !t || /MYMEMORY WARNING/i.test(t))
      throw Error();
    out.push(t);
  }
  return out.join(" ");
}
async function google(text: string) {
  const out: string[] = [];
  for (const part of chunks(text, 1500)) {
    const r = await json(
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=" +
        encodeURIComponent(part),
    );
    const t = (r?.[0] ?? []).map((x: any) => x?.[0] ?? "").join("");
    if (!t) throw Error();
    out.push(t);
  }
  return out.join(" ");
}
/**
 * English to Spanish, cached on the device. Rejects when no service answers,
 * so callers can show the official text instead.
 */
export function toSpanish(text: string): Promise<string> {
  if (!text.trim() || looksSpanish(text)) return Promise.resolve(text);
  const cache: Record<string, string> = readStore(STORE) || {};
  if (cache[text]) return Promise.resolve(cache[text]);
  if (pending.has(text)) return pending.get(text)!;
  const job = (async () => {
    let result = "";
    for (const provider of [builtIn, myMemory, google]) {
      try {
        result = await provider(text);
        if (result) break;
      } catch {
        /* try the next service */
      }
    }
    if (!result) throw Error("Sin traducción disponible");
    const fresh: Record<string, string> = readStore(STORE) || {};
    const keys = Object.keys(fresh);
    for (const k of keys.slice(0, Math.max(0, keys.length - 79))) delete fresh[k];
    fresh[text] = result;
    writeStore(STORE, fresh);
    return result;
  })().finally(() => pending.delete(text));
  pending.set(text, job);
  return job;
}
