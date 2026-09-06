#!/usr/bin/env node
/**
 * Hook PostToolUse : après chaque Edit/Write/MultiEdit sur un fichier JS/TS,
 * vérifie la SYNTAXE avec esbuild (rapide, < 100 ms).
 *
 * But : attraper immédiatement les erreurs qui font planter Vite
 * (balise JSX non fermée, parenthèse manquante, etc.) avant de continuer.
 * Ne vérifie PAS les types (ça, c'est `npm run typecheck`).
 *
 * Sortie code 2 = bloquant : Claude reçoit le message d'erreur et corrige.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

function readStdin() {
  try {
    return readFileSync(0, 'utf8')
  } catch {
    return ''
  }
}

let payload
try {
  payload = JSON.parse(readStdin() || '{}')
} catch {
  process.exit(0)
}

const filePath = payload?.tool_input?.file_path
if (!filePath) process.exit(0)

const m = /\.(tsx|ts|jsx|js|mjs|cjs)$/.exec(filePath)
if (!m) process.exit(0)

const ext = m[1]
const loader = ext === 'ts' ? 'ts' : ext === 'tsx' ? 'tsx' : ext === 'jsx' ? 'jsx' : 'js'

let code
try {
  code = readFileSync(filePath, 'utf8')
} catch {
  process.exit(0) // fichier supprimé / déplacé
}

let esbuild
try {
  esbuild = require('esbuild')
} catch {
  process.exit(0) // esbuild pas dispo : on ne bloque pas
}

try {
  esbuild.transformSync(code, { loader, sourcefile: filePath })
  process.exit(0)
} catch (err) {
  const e = err?.errors?.[0]
  const loc = e?.location
  const where = loc ? `${filePath}:${loc.line}:${loc.column}` : filePath
  const lineText = loc?.lineText ? `\n    ${loc.lineText.trim()}` : ''
  process.stderr.write(
    `❌ Erreur de syntaxe détectée par le hook (esbuild) :\n` +
      `   ${e?.text ?? 'erreur inconnue'}\n` +
      `   ${where}${lineText}\n\n` +
      `Corrige cette erreur avant de continuer — c'est ce qui fait planter Vite.\n`,
  )
  process.exit(2)
}
