import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { VUE_ENTRY, renderShell } from './shell.ts'

test('hmr shell loads the vite dev server and skips the manifest', () => {
	const html = renderShell(true, null)
	assertEquals(html.includes(`http://localhost:5173/static/dist/${VUE_ENTRY}`), true)
	assertEquals(html.includes('id="app"'), true)
	assertEquals(html.includes('just ui-build'), false)
})

test('a build shell uses the manifest paths and a missing build says so', () => {
	const html = renderShell(false, {
		[VUE_ENTRY]: { file: 'entry/main-abc.js' },
		'style.css': { file: 'asset/style-def.css' },
	})
	assertEquals(html.includes('/static/dist/entry/main-abc.js'), true)
	assertEquals(html.includes('/static/dist/asset/style-def.css'), true)
	assertEquals(renderShell(false, null).includes('just ui-build'), true)
	assertEquals(renderShell(false, { [VUE_ENTRY]: { file: '../secret.js' } }).includes('just ui-build'), true)
})
