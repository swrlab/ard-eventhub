import { defineConfig } from 'blume'
import { asyncapi, openapi } from 'blume/reference'
import { filesystem } from 'blume/sources'

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
		sources: [filesystem({ root: 'docs' })],
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
	reference: [
		openapi({
			spec: './openapi.json',
			codeSamples: ['curl', 'js'],
			route: '/api',
		}),
		asyncapi({
			spec: './asyncapi.json',
			route: '/events',
		}),
	],
	navigation: {
		tabs: [
			{ label: 'Docs', path: '/', href: '/' },
			{ label: 'OpenAPI', path: '/api', href: '/api' },
			{ label: 'Events (v3 Connect Beta)', path: '/events', href: '/events' },
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
	agents: {
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
