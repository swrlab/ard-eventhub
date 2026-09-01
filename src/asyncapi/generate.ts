import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildAsyncApiDocument } from './document.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outputPath = resolve(__dirname, '../../asyncapi.json')

/**
 * Generate `asyncapi.json` from Zod schemas for Blume docs.
 */
const main = () => {
	const document = buildAsyncApiDocument()
	mkdirSync(dirname(outputPath), { recursive: true })
	writeFileSync(outputPath, `${JSON.stringify(document, null, '\t')}\n`, 'utf8')
	console.log(`Wrote ${outputPath}`)
}

main()
