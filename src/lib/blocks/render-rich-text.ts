import "server-only";
import { generateHTML } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { JSDOM } from "jsdom";

/**
 * @tiptap/core's generateHTML hardcodes a reference to the global `document`
 * (prosemirror-model's DOMSerializer builds a real DOM tree, then reads
 * innerHTML) — there's no document-injection option in this version, so it
 * throws `window is not defined` when called from Node/RSC as-is.
 *
 * We don't want to permanently set globalThis.window: a lot of code
 * (including React itself) branches on `typeof window` to detect
 * server vs. browser, and generateHTML is synchronous with no internal
 * await, so the polyfill only needs to exist for that one synchronous
 * slice — Node can't interleave other requests' code mid-synchronous-call,
 * so this is safe under concurrent load despite mutating a global.
 */
let dom: JSDOM | undefined;
function getDom(): JSDOM {
  if (!dom) dom = new JSDOM("<!doctype html>");
  return dom;
}

export function renderRichTextToHTML(doc: unknown): string {
  const g = globalThis as unknown as Record<string, unknown>;
  const jsdomWindow = getDom().window;

  const hadWindow = Object.prototype.hasOwnProperty.call(g, "window");
  const hadDocument = Object.prototype.hasOwnProperty.call(g, "document");
  const prevWindow = g.window;
  const prevDocument = g.document;

  g.window = jsdomWindow;
  g.document = jsdomWindow.document;
  try {
    return generateHTML(doc as object, [StarterKit]);
  } finally {
    if (hadWindow) g.window = prevWindow;
    else delete g.window;
    if (hadDocument) g.document = prevDocument;
    else delete g.document;
  }
}
