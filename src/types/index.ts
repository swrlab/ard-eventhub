export type * from './ard.ts'
export type * from './eventhub.ts'
export type * from './external.ts'

/**
 * @see https://github.com/swrlab/ard-eventhub/blob/main/docs/STAGES.md
 */
export type Stage = 'dev' | 'prod' | 'test'

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

export type RadioplayerApiKeys = {
	[key: string]: string
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

// Express
export type RequestError = {
	status?: number
	message: string
	errors?: string | { path: string; message: string; errorCode: string }[]
	data?: Record<string, string>
	trace?: string
}
