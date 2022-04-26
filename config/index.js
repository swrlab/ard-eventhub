/*

	ard-eventhub
	by SWR audio lab

*/

// import version from package.json
const { version } = require('../package.json')
const coreIdPrefixes = require('./coreIdPrefixes.json')

// check existence of several process vars
if (!process.env.SERVICE_NAME) {
	console.error('process.env.SERVICE_NAME not found')
	process.exit(1)
} else if (!process.env.GCP_PROJECT_ID) {
	console.error('process.env.GCP_PROJECT_ID not found')
	process.exit(1)
} else if (!process.env.FIREBASE_API_KEY) {
	console.error('process.env.FIREBASE_API_KEY not found')
	process.exit(1)
} else if (!process.env.PUBSUB_SERVICE_ACCOUNT_EMAIL_INTERNAL) {
	console.error('process.env.PUBSUB_SERVICE_ACCOUNT_EMAIL_INTERNAL not found')
	process.exit(1)
}

// read env vars
const stage = process.env.STAGE.toLowerCase()
const port = process.env.PORT || 8080

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
