import { defineConfig } from 'blume'

export default defineConfig({
	title: 'ARD Eventhub',
	description: 'Echtzeit-Metadaten für Hörfunksendungen der ARD verteilen.',
	github: {
		owner: 'swrlab',
		repo: 'ard-eventhub',
	},
	content: {
		root: 'docs',
	},
	export: {
		pdf: true
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
		accent: 'blue',
		mode: 'system',
	},
	openapi: {
		enabled: true,
		spec: './openapi.yaml',
		route: '/api',
	},
	navigation: {
		tabs: [
			{ label: 'Docs', path: '/', href: '/' },
			{ label: 'Open API', path: '/api', href: '/api' },
		],
		featured: [
			{
				label: 'Changelog',
				href: 'https://github.com/swrlab/ard-eventhub/blob/main/CHANGELOG.md',
				icon: 'newspaper',
			},
		],
		sidebar: [
			'/',
			{
				label: 'Schnellstart',
				collapsed: false,
				items: ['/quickstart', '/authentication', '/common-ids', '/external-ids', '/events', '/plugins', '/types'],
			},
			'/openapi',
			{
				label: 'Tech',
				collapsed: false,
				items: ['/naming', '/secrets', '/stages'],
			},
			{
				label: 'Admin',
				collapsed: true,
				items: ['/users'],
			},
		],
	},
	ai: {
		llmsTxt: {
			enabled: true,
			openapi: true,
		},
	},
	feedback: false,
	seo: {
		og: { enabled: true },
		sitemap: true,
		robots: true,
		structuredData: true,
	},
})
