type EventhubTopic = {
	id: string
	name: string
	status?: string
	messageId?: string | null
}

export type EventhubService = {
	type: string
	externalId: string
	publisherId: string
	id?: string // TODO: check this if it has not ne Nullable
	blocked?: string
	topic?: EventhubTopic
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

type EventhubMedia = {
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
	id?: string | number // dynamically set by datastore

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

export type EventhubTopicDatastore = {
	// id: string // dynamically set by datastore

	created: string // ISO Date
	creator: string // email

	coreId: EventhubTopic['id']
	externalId: EventhubService['externalId']
	name: EventhubTopic['name']

	institution: {
		id: string // ArdInstitution['id']
		title: string // ArdInstitution['title']
	}

	publisher: {
		id: string // ArdPublisher['id']
		title: string // ArdPublisher['title']
	}
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

	ackDeadlineSeconds: undefined | number | null
	// biome-ignore lint/suspicious/noExplicitAny: here any is alright since we cannot reference the original type.
	retryPolicy: Record<PropertyKey, any> | null | undefined
	serviceAccount: string | null | undefined

	url: string | null | undefined
	contact: string | undefined
	institutionId: string | undefined
}

export type EventhubSubscriptionWithLabels = EventhubSubscriptionLimited & {
	labels:
		| {
				/** Integer (as string) */
				id: string
				stage: string
				'creator-slug': string
				created: string
		  }
		| undefined
}

export type EventhubPluginMessage = {
	action: string
	event: EventhubV1RadioPostBody
	plugin: EventhubPlugin
	institutionId: string
}
