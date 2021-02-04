/*

	ard-eventhub
	by SWR audio lab

*/

const datastore = require('../../utils/datastore');
const pubsub = require('../../utils/pubsub');
const moment = require('moment');

module.exports = async (req, res) => {
	try {
		// map inputs
		let subscription = {
			name: `dev-auth-user-${moment().format('YYYY-DDDD--x')}`,
			type: req.body.type,
			method: req.body.method,
			url: req.body.url,
			email: req.body.email,
			topic: req.body.topic,
			created: moment().toISOString(),
		};

		// save to datastore
		subscription = await datastore.save(subscription, 'subscriptions');

		// check existence of topic
		try {
			await pubsub.getTopic(subscription.topic);
		} catch (topicErr) {
			console.error(
				'ingest/subscription/post',
				'failed to find desired topic',
				JSON.stringify({
					subscription,
					error: topicErr.stack || topicErr,
				})
			);
			return res.sendStatus(404);
		}

		// create subscription
		let createdSubscription = await pubsub.createSubscription(subscription);

		// return data
		res.status(200).json({ createdSubscription });
	} catch (err) {
		console.error(
			'ingest/subscriptions/post',
			'failed to create subscription',
			JSON.stringify({
				body: req.body,
				error: err.stack || err,
			})
		);
		return res.sendStatus(500);
	}
};
