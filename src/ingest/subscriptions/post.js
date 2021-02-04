/*

	ard-eventhub
	by SWR audio lab

*/

// load node utils
const moment = require('moment');

// load eventhub utils
const datastore = require('../../utils/datastore');
const pubsub = require('../../utils/pubsub');
const response = require('../../utils/response');

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

		// request creation of subscription
		let createdSubscription = await pubsub.createSubscription(subscription);

		// return data
		res.status(201).json(createdSubscription);
	} catch (err) {
		console.error(
			'ingest/subscriptions/post',
			'failed to create subscription',
			JSON.stringify({
				body: req.body,
				error: err.stack || err,
			})
		);
		return response.internalServerError(req, res, err);
	}
};
