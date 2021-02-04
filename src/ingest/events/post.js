/*

	ard-eventhub
	by SWR audio lab

*/

const pubsub = require('../../utils/pubsub');

module.exports = async (req, res) => {
	try {
		// DEV do more case-secific checks here

		// DEV this is a very random test
		let messageIds = await pubsub.publishMessage(['dev', 'dev2'], {
			body: req.body,
			headers: req.headers,
		});

		res.status(201).json({
			messageIds,
			body: req.body,
			headers: req.headers,
		});
	} catch (err) {
		console.error(
			'ingest/events/post',
			'failed to publish event',
			JSON.stringify({
				body: req.body,
				headers: req.headers,
				error: err.stack || err,
			})
		);
		return res.sendStatus(500);
	}
};
