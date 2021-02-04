/*

	ard-eventhub
	by SWR audio lab

*/

const pubsub = require('../../utils/pubsub');

module.exports = async (req, res) => {
	try {
		// load all topics
		let topics = await pubsub.getTopics();

		// DEV filter topics by prefix

		// return data
		res.status(200).json(topics);
	} catch (err) {
		console.error(
			'ingest/topics/post',
			'failed to create subscription',
			JSON.stringify({
				body: req.body,
				error: err.stack || err,
			})
		);
		return res.sendStatus(500);
	}
};
