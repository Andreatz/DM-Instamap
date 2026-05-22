#!/usr/bin/env node
// Fase I - Gate lingua UI: il testo rivolto all'utente in apps/web deve essere
// in italiano. Cerca parole UI chiaramente inglesi nel testo JSX e negli
// attributi visibili (aria-label, placeholder, title, alt). Identificatori,
// nomi di formato/prodotto e commenti non sono interessati.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const SCAN_DIR = path.join(ROOT, "apps", "web", "src");

// Parole UI inequivocabilmente inglesi (hanno un equivalente italiano atteso).
const ENGLISH_UI_WORDS = [
  "save",
  "cancel",
  "delete",
  "loading",
  "search",
  "close",
  "submit",
  "settings",
  "welcome",
  "remove",
  "create",
  "edit",
  "back",
  "next",
  "failed",
  "success",
  "login",
  "logout",
  "download",
  "upload"
];
const WORD_PATTERN = new RegExp(`\\b(${ENGLISH_UI_WORDS.join("|")})\\b`, "iu");

// Frammenti consentiti (nomi di prodotto/formato/feature) anche se contengono
// testo inglese: non sono "UI da tradurre".
const ALLOWED_FRAGMENTS =
  /Session Pack|Foundry|DM-Instamap|Style DNA|dd2vtt|dmimap/u;

const JSX_TEXT = />\s*([^<>{}\n][^<>{}]*?)\s*</gu;
const UI_ATTR = /(?:aria-label|placeholder|title|alt|label)=["']([^"']+)["']/gu;

function walk(dir, files) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (
      entry.name.endsWith(".tsx") &&
      !entry.name.endsWith(".test.tsx")
    ) {
      files.push(full);
    }
  }
}

function isSuspect(text) {
  const trimmed = text.trim();
  if (!trimmed || ALLOWED_FRAGMENTS.test(trimmed)) {
    return false;
  }
  // Ignora frammenti che sono solo espressioni/simboli o singole parole in
  // PascalCase/camelCase (probabili identificatori, non testo UI).
  if (!/[a-z]/u.test(trimmed)) {
    return false;
  }
  return WORD_PATTERN.test(trimmed);
}

const files = [];
walk(SCAN_DIR, files);
const violations = [];

for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith("//") || trimmedLine.startsWith("*")) {
      return;
    }

    for (const pattern of [JSX_TEXT, UI_ATTR]) {
      pattern.lastIndex = 0;
      let match = pattern.exec(line);
      while (match) {
        const candidate = match[1] ?? "";
        if (isSuspect(candidate)) {
          const rel = path.relative(ROOT, file).split(path.sep).join("/");
          violations.push(
            `${rel}:${index + 1} testo UI in inglese: "${candidate.trim()}"`
          );
        }
        match = pattern.exec(line);
      }
    }
  });
}

if (violations.length > 0) {
  console.error("UI language audit failed (la UI deve essere in italiano):");
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

console.log(
  `UI language audit passed (${files.length} file .tsx controllati).`
);
