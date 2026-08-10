import { defineConfig } from 'blume'

// icons are documented in https://lucide.dev/icons/

export default defineConfig({
	title: 'ARD Eventhub',
	description: 'Echtzeit-Metadaten für Hörfunksendungen der ARD verteilen.',
	// banner: 'if needed',
	feedback: false,
	logo: {
		image: 'favicon.svg',
	},
	github: {
		owner: 'swrlab',
		repo: 'ard-eventhub',
	},
	content: {
		sources: [{ type: 'filesystem', root: 'docs' }],
	},
	export: {
		pdf: true,
	},
	i18n: {
		defaultLocale: 'de',
		locales: [{ code: 'de', label: 'Deutsch' }],
	},
	deployment: {
		site: 'https://swrlab.github.io',
		base: '/ard-eventhub',
		output: 'static',
	},
	theme: {
		accent: 'rgb(29, 11, 64)', // a named preset or any CSS color
		radius: 'none', // none | sm | md | lg
		mode: 'dark', // system | light | dark
		fonts: {
			display: 'geist',
			body: 'geist',
			mono: 'geist-mono',
		},
	},
	openapi: {
		enabled: true,
		spec: './openapi.json',
		codeSamples: ['curl', 'js'],
		route: '/api',
	},
	navigation: {
		tabs: [
			{ label: 'Docs', path: '/', href: '/' },
			{ label: 'OpenAPI', path: '/api', href: '/api' },
		],
		featured: [
			{
				label: 'Changelog',
				href: 'https://github.com/swrlab/ard-eventhub/blob/main/CHANGELOG.md',
				icon: 'newspaper',
			},
			{
				label: 'Issues/ Roadmap',
				href: 'https://github.com/swrlab/ard-eventhub/issues',
				icon: 'bug',
			},
			{
				label: 'Confluence',
				href: 'https://confluence.ard.de/x/il8uGw',
				icon: 'book-open-text',
			},
		],
	},
	ai: {
		llmsTxt: {
			enabled: true,
			openapi: true,
		},
		mcp: {
			enabled: false,
		},
	},
	seo: {
		og: { enabled: true },
		sitemap: true,
		robots: true,
		structuredData: true,
	},
})
