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
