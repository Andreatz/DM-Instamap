#!/usr/bin/env node
// Fase C - Gate dimensione file applicativi.
//
// Nessun file sorgente (non di test) deve superare LIMIT righe senza una
// eccezione documentata. L'allowlist e un "ratchet": ogni file elencato non
// puo crescere oltre la sua baseline e va rimosso man mano che viene spezzato.

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const LIMIT = 700;
const SCAN_DIRS = ["apps", "packages"];
const IGNORED_SEGMENTS = new Set(["node_modules", "dist", ".next", "coverage"]);

// Eccezioni motivate: file gia sopra il limite, con la baseline corrente come
// tetto massimo. Vanno ridotti e rimossi nelle iterazioni della Fase C.
const ALLOWLIST = {
  "apps/web/src/lib/map-editor.ts": {
    maxLines: 1090,
    reason: "Operazioni documento editor; candidato a split incrementale."
  },
  "packages/generator/src/blueprint.ts": {
    maxLines: 1040,
    reason: "Costruzione blueprint narrativa; split incrementale futuro."
  },
  "packages/generator/src/furnishing.ts": {
    maxLines: 960,
    reason: "Regole di arredamento; split incrementale futuro."
  },
  "packages/assets/src/embeddings.ts": {
    maxLines: 920,
    reason: "Pipeline embeddings locale; split incrementale futuro."
  },
  "apps/web/src/components/generate/dungeon-generator-preview.tsx": {
    maxLines: 725,
    reason:
      "Componente anteprima generatore; estrazione sotto-componenti futura."
  },
  "packages/assets/src/audit.ts": {
    maxLines: 715,
    reason: "Audit duplicati/qualita asset; split incrementale futuro."
  },
  "packages/exporters/src/dd2vtt.ts": {
    maxLines: 727,
    reason:
      "Exporter/parser dd2vtt con hardening import (Fase L); split incrementale futuro."
  },
  "packages/exporters/src/raster.ts": {
    maxLines: 755,
    reason:
      "Render raster: scala reale asset + texture floor/wall via pattern; split per-helper futuro."
  },
  "apps/web/src/components/editor/editor-inspector.tsx": {
    maxLines: 705,
    reason: "Inspector editor; estrazione sotto-pannelli futura."
  }
};

function countLines(filePath) {
  const content = readFileSync(filePath, "utf8");
  if (content.length === 0) {
    return 0;
  }
  const newlines = content.split("\n").length;
  return content.endsWith("\n") ? newlines - 1 : newlines;
}

function walk(dir, files) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_SEGMENTS.has(entry.name)) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (
      /\.(ts|tsx)$/u.test(entry.name) &&
      !/\.test\.tsx?$/u.test(entry.name)
    ) {
      files.push(full);
    }
  }
}

const files = [];
for (const dir of SCAN_DIRS) {
  const abs = path.join(ROOT, dir);
  try {
    if (statSync(abs).isDirectory()) {
      walk(abs, files);
    }
  } catch {
    // dir assente: ignora
  }
}

const violations = [];
const staleAllowlist = new Set(Object.keys(ALLOWLIST));

for (const file of files) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  const lines = countLines(file);
  const exception = ALLOWLIST[rel];

  if (exception) {
    staleAllowlist.delete(rel);
    if (lines > exception.maxLines) {
      violations.push(
        `${rel}: ${lines} righe supera la baseline allowlist di ${exception.maxLines}.`
      );
    }
    continue;
  }

  if (lines > LIMIT) {
    violations.push(
      `${rel}: ${lines} righe supera il limite di ${LIMIT}. Spezzalo o aggiungi un'eccezione motivata.`
    );
  }
}

// Voci di allowlist non piu presenti (file spezzato/rimosso): vanno tolte.
for (const rel of staleAllowlist) {
  violations.push(
    `${rel}: presente nell'allowlist ma non trovato. Rimuovi la voce obsoleta.`
  );
}

if (violations.length > 0) {
  console.error("File size audit failed:");
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

console.log(
  `File size audit passed (${files.length} file, limite ${LIMIT}, ${Object.keys(ALLOWLIST).length} eccezioni documentate).`
);
