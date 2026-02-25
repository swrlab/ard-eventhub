export type EventhubService = {
	type: string
	externalId: string
	publisherId: string
	id?: string // TODO check this
	blocked?: string
	topic?: {
		id: string
		name: string
		status?: string
		messageId?: string | null
	}
}

export type EventhubPlugin = {
	type: string
	isDeactivated: boolean
	note?: string
	delay?: number
	album?: string
	composer?: string
	program?: string
	subject?: string
	webUrl?: string
	preferArtistMedia?: boolean
	enableThumbs?: boolean
	email?: string
	excludeFields?: string[]
}

export type EventhubMedia = {
	type: string
	url: string
	templateUrl: string | null
	description: string
	attribution: string | null
	isFallback?: boolean
}

export type EventhubV1RadioPostBodyInput = {
	type: string
	start: string
	title: string
	services: EventhubService[]
	playlistItemId: string

	event: string
	length: number | null
	artist: string | null
	contributors: {
		name: string
		role:
			| 'artist'
			| 'author'
			| 'composer'
			| 'performer'
			| 'conductor'
			| 'choir'
			| 'leader'
			| 'ensemble'
			| 'orchestra'
			| 'soloist'
			| 'producer'
			| 'engineer'
			| null
		normDb: {
			type: string
			id: string
		} | null
		isni: string | null
		url: string | null
	}[]
	references: {
		type: string
		externalId: string
		alternateIds: string[]
	}[]
	hfdbIds: (string | null)[]
	externalId: string
	isrc: string | null
	upc: string | null
	mpn: string | null
	media: EventhubMedia[]
	plugins: EventhubPlugin[]
}

export type EventhubV1RadioPostBody = EventhubV1RadioPostBodyInput & {
	name: string
	creator: string
	created: string
	id: string
}

export type EventhubSubscriptionDatastore = {
	id: string | undefined // dynamically set by datastore

	name: string
	type: string
	method: string
	url: string
	contact: string
	topic: string

	creator: string
	institutionId: string
	created: string
}

export type EventhubSubscriptionLimited = {
	type: string
	method: string

	name: string | undefined
	path: string | null | undefined

	topic: {
		id: string
		name: string
		path: string
	}

	ackDeadlineSeconds: number
	retryPolicy: string
	serviceAccount: string

	url: string
	contact: string | null
	institutionId: string | null
}

export type EventhubSubscriptionWithLabels = EventhubSubscriptionLimited & {
	labels: {
		id: string
		stage: string
		'creator-slug': string
		created: string
	}
}

export type EventhubPluginMessage = {
	action: string
	event: EventhubV1RadioPostBody
	plugin: EventhubPlugin
	institutionId: string
}

// ARD
export type ArdBinary = {
	coremediaId: string
	href: string
	availableFrom: string
	startDate: string
	titel: string
	adaptivity: string
	distributionType: string
	packaging: string
	audioChannel: string
	audioBitrate: number
	audioCodec: string
}

export type ArdImage = {
	id: string
	url: string
	aspectRatio: string
	type: string
	producer: string
}

export type ArdPublisher = {
	id: string
	coremediaId: string
	externalId: string
	title: string
	institution: ArdInstitution
	imageURL: string
	homepageURL: string
}

export type ArdInstitution = {
	id: string
	coremediaId: string
	title: string
	imageURL: string
	externalId: string
	acronym: string
	channel: string
}

export type ArdLivestream = {
	publisher: ArdPublisher
	images: ArdImage[]
	binaries: ArdBinary[]

	id: string
	coremediaId: number
	externalId: string
	type: string
	title: string
	avType: string
	description: string
	created: string
	modified: string
	producer: string
	keywords: string[]
	geoAvailability: string
	isOnlineOnly: boolean
	isChildContent: boolean
	isMovie: boolean
	links: {
		web: string
	}
	subgenreCategories: string[]
	thematicCategories: string[]
	normDbLocations: object[]
	countriesOfOrigin: string[]

	// these are modifiable fields
	image?: ArdImage
	isAacSupported?: boolean
	isMp3Supported?: boolean
}

export type ArdFeed = {
	totalItemCount: number
	totalPageCount: number
	pageItemCount: number
	pageIndex: number
	generated: string
	self: string
	items: ArdLivestream[]
}
