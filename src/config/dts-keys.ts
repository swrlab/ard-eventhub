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

interface PermittedExcludedFields {
	media: string
}

interface DTSKeys {
	credentials: Credentials
	endpoints: Endpoints
	integrationName: string
	permittedExcludedFields: PermittedExcludedFields
}

const keys = Buffer.from(process.env.DTS_KEYS as string, 'base64').toString('utf8')
const dts: DTSKeys = JSON.parse(keys)

export default dts
