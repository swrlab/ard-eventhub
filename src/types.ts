import type { google } from '@google-cloud/pubsub/build/protos/protos.js'
import type { Request } from 'express'
import type { DecodedIdToken } from 'firebase-admin/auth'

export type { Subscription } from '@google-cloud/pubsub'
export type { NextFunction, Response } from 'express'

// Google PubSub
export type ISubscription = google.pubsub.v1.ISubscription
export type ITopic = google.pubsub.v1.ITopic

// DTS Keys
export interface LiveradioCredential {
	coreId: string
	username: string
	password: string
	api_key: string
}

interface Credentials {
	dashboardToken: string
	liveradio: LiveradioCredential[]
}

interface LiveRadioEndpoint {
	dev: string
	test: string
	beta: string
	prod: string
}

interface Endpoints {
	listIntegrationRecords: string
	searchBroadcasts: string
	liveRadioEvent: LiveRadioEndpoint
}

export interface PermittedExcludedFields {
	media: string
}

export interface DTSKeys {
	credentials: Credentials
	endpoints: Endpoints
	integrationName: string
	permittedExcludedFields: PermittedExcludedFields
}

// DTS Event
// note all fields have a null options, since excludeFields can be used to exclude fields from the event
export type LiveRadioEvent = {
	broadcastId: string | null
	contentId: string | null
	type: string | null
	status: string | null
	client: string | null
	clientVersion: string | null
	timestamp: string | null
	artist: string | null
	title: string | null
	isrc: string | null
	email: string | null
	duration: number | null
	delay: number | null
	album: string | null
	composer: string | null
	program: string | null
	subject: string | null
	webURL: string | null
	enableShare: boolean | null
	enableThumbs: boolean | null
	year: number | null
	fccId: string | null
	imageURL: string | null
}

// Eventhub

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
		id: ArdInstitution['id'] // TODO: or Number?
		title: ArdInstitution['title']
	}

	publisher: {
		id: ArdPublisher['id']
		title: ArdPublisher['title']
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

	ackDeadlineSeconds?: number | null
	// biome-ignore lint/suspicious/noExplicitAny: here any is alright since we cannot reference the original type.
	retryPolicy?: Record<PropertyKey, any> | null
	serviceAccount?: string | null

	url?: string | null
	contact?: string
	institutionId?: string
}

export type EventhubSubscriptionWithLabels = EventhubSubscriptionLimited & {
	labels?: {
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

// Express
export type { Request }

export type RequestError = {
	status?: number
	message: string
	errors?: string | { path: string; message: string; errorCode: string }[]
	data?: Record<string, string>
	trace?: string
}

// Express Middlewares

export interface UserTokenRequest extends Request {
	user?: DecodedIdToken
}

// taken from express
interface ParamsDictionary {
	[key: string]: string | string[]
	[key: number]: string
}

export interface UserTokenRequestWithParams<P = ParamsDictionary> extends Request<P> {
	user?: DecodedIdToken
}
