/*

	ard-eventhub
	by SWR Audio Lab

*/

// load node utils
import { DateTime } from 'luxon'
import slug from 'slug'

// load utils
import logger from '../logger'
import pubSubSubscriberClient from './_subscriberClient'
import mapSubscription from './mapSubscription.ts'

// load config
import config from '../../../config'
import { google } from '@google-cloud/pubsub/build/protos/protos'
import ISubscription = google.pubsub.v1.ISubscription

const source = 'utils/pubsub/createSubscription'

export default async (subscription: any) => {
	// map inputs for pubsub
	const options: ISubscription = {
		name: `projects/${process.env.GCP_PROJECT_ID}/subscriptions/${subscription.name}`,
		topic: `projects/${process.env.GCP_PROJECT_ID}/topics/${subscription.topic}`,
		pushConfig: {
			pushEndpoint: subscription.url,
			oidcToken: {
				serviceAccountEmail:
					'publisher@ard-eventhub.iam.gserviceaccount.com',
				audience: '',
			},
		},
		labels: {
			id: subscription.id,
			stage: config.stage!!,
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
	const [createdSubscription] =
		await pubSubSubscriberClient.createSubscription(options)
	logger.log({
		level: 'info',
		message: 'created subscription',
		source,
		data: { createdSubscription },
	})

	// map and filter values
	const mappedCreatedSubscription = { metadata: null, ...createdSubscription }
	const { limited: mappedSubscription } =	await mapSubscription(mappedCreatedSubscription)
	logger.log({
		level: 'info',
		message: 'mapped subscription',
		source,
		data: { mappedSubscription },
	})

	// return data
	return Promise.resolve(mappedSubscription)
}
