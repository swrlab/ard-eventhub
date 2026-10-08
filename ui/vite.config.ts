import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [vue(), tailwindcss()],
	server: {
		port: 5173,
		fs: {
			allow: [fileURLToPath(new URL('..', import.meta.url))],
		},
		proxy: {
			'/api': {
				target: 'http://127.0.0.1:4173',
				ws: true,
			},
		},
	},
})
