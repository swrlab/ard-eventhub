/*

	ard-eventhub
	by SWR audio lab

*/

// import version from package.json
const { version } = require('../package.json')
const coreIdPrefixes = require('./coreIdPrefixes.json')

// load winston logger
const logger = require('../src/utils/logger')

// read env vars
const stage = process.env.STAGE.toLowerCase()
const port = process.env.PORT || 8080

const exitWithError = (message) => {
	logger.log({
		level: 'error',
		message,
		source: 'config',
	})
	process.exit(1)
}

// check env vars
if (!process.env.SERVICE_NAME) exitWithError('SERVICE_NAME not found')
if (!process.env.GCP_PROJECT_ID) exitWithError('GCP_PROJECT_ID not found')
if (!process.env.FIREBASE_API_KEY) exitWithError('FIREBASE_API_KEY not found')
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) exitWithError('GOOGLE_APPLICATION_CREDENTIALS not found')
if (!process.env.PUBSUB_SERVICE_ACCOUNT_EMAIL_INTERNAL) exitWithError('PUBSUB_SERVICE_ACCOUNT_EMAIL_INTERNAL not found')

// set protocol, hostname and hostUrl
const protocol = stage === 'dev' ? 'http' : 'https'
const hostname = stage === 'dev' ? 'localhost' : `eventhub-ingest.ard.de`
const serviceUrl = `${protocol}://${hostname}:${port}`

// set config
const serviceName = process.env.SERVICE_NAME
const baseConfig = {
	coreIdPrefixes,
	pubSubPrefix: `de.ard.eventhub.${stage}.`,
	pubSubTopicSelf: `de.ard.eventhub.${stage}.internal`,
	stage,
	port,
	userAgent: `${serviceName}/${version}`,
	version,
	serviceUrl,
	isDebug: process.env.DEBUG === 'true',
	isDev: process.env.STAGE === 'dev',
}

// set config based on stages
const config = {
	dev: {
		...baseConfig,
		serviceName: `${serviceName}-dev`,
	},
	test: {
		...baseConfig,
		serviceName: `${serviceName}-test`,
	},
	prod: {
		...baseConfig,
		serviceName,
	},
}

// check stage and config
if (!stage || !config[stage]) {
	console.error('STAGE not found >', stage)
	process.exit(1)
}

// update user agent env for undici-wrapper
process.env.USER_AGENT = config.userAgent

module.exports = config[stage]
