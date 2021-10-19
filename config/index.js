/*

	ard-eventhub
	by SWR audio lab

*/

// import version from package.json
const { version } = require('../package.json')
const coreIdPrefixes = require('./coreIdPrefixes.json')

// check existence of several process vars
if (!process.env.GCP_PROJECT_ID) {
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
const stage = process.env.STAGE

// set config
const serviceName = 'ard-eventhub'
const baseConfig = {
	coreIdPrefixes,
	pubSubPrefix: `de.ard.eventhub.${stage}.`,
	pubSubTopicSelf: `de.ard.eventhub.${stage}.internal`,
	stage,
	userAgent: `${serviceName}/${version}`,
	version,
	isDebug: process.env.DEBUG === 'true',
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
