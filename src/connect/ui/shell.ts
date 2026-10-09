import { readFileSync } from 'node:fs'
import { isRecord } from './json.ts'

/** Vite input. The manifest and the dev server both key off this path. */
export const VUE_ENTRY = 'src/connect/ui/client/main.ts'

const VITE_DEV_ORIGIN = 'http://localhost:5173'

const MISSING_HTML = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>ARD Eventhub Connect</title>
<body style="background:#000;color:#ededed;font-family:ui-monospace,monospace;margin:2rem">
<p>operator ui is not built.</p>
<p>just ui-build</p>
</body>
</html>`

/**
 * Whether a manifest path is a file under `static/dist`, not a traversal.
 * @param file - Path from the Vite manifest
 * @returns True when it is safe to put in a URL
 */
const safeAsset = (file: string): boolean =>
	file.length > 0 && !file.startsWith('/') && !file.includes('..') && !file.includes('\\') && !file.includes(':')

/**
 * Read one manifest entry's output file.
 * @param manifest - Parsed Vite manifest
 * @param key - Source path, or `style.css` when CSS is not split
 * @returns Relative file, or null
 */
const assetFile = (manifest: Record<string, unknown>, key: string): string | null => {
	const entry = manifest[key]
	if (!isRecord(entry)) return null
	const file = entry.file
	return typeof file === 'string' && safeAsset(file) ? file : null
}

/**
 * Read `static/dist/manifest.json`. Missing or unreadable means the UI is not built.
 * @param path - Absolute manifest path
 * @returns Parsed object, or null
 */
export const readManifest = (path: string): Record<string, unknown> | null => {
	try {
		const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
		return isRecord(parsed) ? parsed : null
	} catch {
		return null
	}
}

/**
 * Stylesheet and module tags for a production build.
 * @param manifest - Vite manifest, or null
 * @returns Tags, or null when the entry is missing
 */
const builtAssets = (manifest: Record<string, unknown> | null): string | null => {
	if (!manifest) return null
	const script = assetFile(manifest, VUE_ENTRY)
	const style = assetFile(manifest, 'style.css')
	if (!script) return null
	const link = style ? `<link rel="stylesheet" href="/static/dist/${style}">` : ''
	return `${link}<script type="module" src="/static/dist/${script}"></script>`
}

/**
 * HTML shell for the operator UI. Dev points at the Vite server. A build uses the manifest.
 * @param useHmr - `USE_HMR=true`
 * @param manifest - Vite manifest, or null when it has not been built
 * @returns Document to serve for every UI route
 */
export const renderShell = (useHmr: boolean, manifest: Record<string, unknown> | null): string => {
	const assets = useHmr
		? `<script type="module" src="${VITE_DEV_ORIGIN}/static/dist/${VUE_ENTRY}"></script>`
		: builtAssets(manifest)
	if (!assets) return MISSING_HTML
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>ARD Eventhub Connect</title>
${assets}
</head>
<body>
<div id="app"></div>
</body>
</html>`
}
