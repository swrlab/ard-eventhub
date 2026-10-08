import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// `USE_HMR=dev` prefixes the asset base with the dev server. The connect process
// loads that server when `USE_HMR=true`, and otherwise serves `static/dist`.
const useHmr = process.env.USE_HMR === 'dev'
const baseHost = useHmr ? 'http://localhost:5173' : ''

export default defineConfig({
	base: `${baseHost}/static/dist/`,
	appType: 'custom',
	build: {
		target: 'baseline-widely-available',
		outDir: './static/dist/',
		emptyOutDir: true,
		assetsDir: 'assets',
		assetsInlineLimit: 64,
		manifest: 'manifest.json',
		chunkSizeWarningLimit: 1000,
		cssCodeSplit: false,
		rolldownOptions: {
			input: resolve(import.meta.dirname, './src/connect/ui/client/main.ts'),
			output: {
				assetFileNames: 'asset/[name]-[hash].[ext]',
				chunkFileNames: 'chunks/[name]-[hash].js',
				entryFileNames: 'entry/[name]-[hash].js',
			},
		},
		sourcemap: useHmr,
	},
	plugins: [vue(), tailwindcss()],
	server: {
		port: 5173,
		strictPort: true,
	},
})
