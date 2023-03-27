/*

	ard-eventhub
	by SWR Audio Lab

*/

// load node utils
const { DateTime } = require('luxon')
const slug = require('slug')

// load utils
const logger = require('../logger')
const pubSubSubscriberClient = require('./_subscriberClient')
const mapSubscription = require('./mapSubscription')

// load config
const config = require('../../../config')

const source = 'utils/pubsub/createSubscription'

module.exports = async (subscription) => {
	// map inputs for pubsub
	const options = {
		name: `projects/${process.env.GCP_PROJECT_ID}/subscriptions/${subscription.name}`,
		topic: `projects/${process.env.GCP_PROJECT_ID}/topics/${subscription.topic}`,
		pushConfig: {
			pushEndpoint: subscription.url,
			oidcToken: {
				serviceAccountEmail: 'publisher@ard-eventhub.iam.gserviceaccount.com',
				audience: '',
			},
			authenticationMethod: 'oidcToken',
		},
		labels: {
			id: subscription.id,
			stage: config.stage,
			'creator-slug': slug(subscription.creator),
			created: DateTime.now().toFormat('yyyy-LL-dd'),
		},
		ackDeadlineSeconds: 20,
		expirationPolicy: {},
	}
	logger.log({
		level: 'info',
		message: 'built options',
		source,
		data: { subscription, options },
	})

	// submit subscription
	const [createdSubscription] = await pubSubSubscriberClient.createSubscription(options)
	logger.log({
		level: 'info',
		message: 'created subscription',
		source,
		data: { createdSubscription },
	})

	// map and filter values
	const { limited: mappedSubscription } = await mapSubscription(createdSubscription)
	logger.log({
		level: 'info',
		message: 'mapped subscription',
		source,
		data: { mappedSubscription },
	})

	// return data
	return Promise.resolve(mappedSubscription)
}
