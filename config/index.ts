/*

	ard-eventhub
	by SWR Audio Lab

*/

// import version from package.json
import { version } from '../package.json'
import coreIdPrefixes from './core-id-prefixes.json'

// load winston logger
import logger from '../src/utils/logger'

const exitWithError = (message: string) => {
	logger.log({
		level: 'error',
		message,
		source: 'config',
	})
	process.exit(1)
}

// check env vars
if (!process.env.DTS_KEYS) exitWithError('DTS_KEYS not found')
if (!process.env.FIREBASE_API_KEY) exitWithError('FIREBASE_API_KEY not found')
if (!process.env.GCP_PROJECT_ID) exitWithError('GCP_PROJECT_ID not found')
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) exitWithError('GOOGLE_APPLICATION_CREDENTIALS not found')
if (!process.env.PUBSUB_SERVICE_ACCOUNT_EMAIL_INTERNAL) exitWithError('PUBSUB_SERVICE_ACCOUNT_EMAIL_INTERNAL not found')
if (!process.env.SERVICE_NAME) exitWithError('SERVICE_NAME not found')

// set static envs
const stage = process.env.STAGE?.toLowerCase()
const protocol = stage === 'dev' ? 'http' : 'https'
const hostname = stage === 'dev' ? 'localhost' : 'eventhub-ingest.ard.de'
const port = process.env.PORT || 8080
const serviceName = process.env.SERVICE_NAME

// set config
export default {
	// load core data
	coreIdPrefixes,

	// set pub sub config
	pubSubPrefix: `de.ard.eventhub.${stage}.`,
	pubSubTopicSelf: `de.ard.eventhub.${stage}.internal`,

	// set service config
	serviceName,
	stage,
	port,
	version,
	serviceUrl: `${protocol}://${hostname}:${port}`,

	// custom user agent for headers
	userAgent: `${serviceName}/${version}`,

	// set service flags
	isDev: process.env.STAGE === 'dev',
	isLocal: process.env.IS_LOCAL === 'true',
}

// update user agent env for undici-wrapper
process.env.USER_AGENT = `${serviceName}/${version}`
