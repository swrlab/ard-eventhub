/*

	ard-eventhub
	by SWR audio lab

*/

// load node utils
const moment = require('moment')

// load utils
const pubSubSubscriberClient = require('./_subscriberClient')
const mapSubscription = require('./mapSubscription')
const config = require('../../../config')

const functionName = 'utils/pubsub/createSubscription'

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
			institution: subscription.institution.name,
			stage: config.stage,
			created: moment().format('YYYY-MM-DD--x'),
		},
		ackDeadlineSeconds: 20,
		expirationPolicy: {},
	}
	console.log(functionName, 'built options', JSON.stringify({ subscription, options }))

	// submit subscription
	let [createdSubscription] = await pubSubSubscriberClient.createSubscription(options)
	console.log(functionName, 'created subscription', JSON.stringify({ createdSubscription }))

	// map and filter values
	createdSubscription = await mapSubscription(createdSubscription)
	console.log(functionName, 'mapped subscription', JSON.stringify({ createdSubscription }))

	// return data
	return Promise.resolve(createdSubscription)
}
