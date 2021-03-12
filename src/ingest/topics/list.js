/*

	ard-eventhub
	by SWR audio lab

*/

const pubsub = require('../../utils/pubsub');
const response = require('../../utils/response');

module.exports = async (req, res) => {
	try {
		// load all topics
		let topics = await pubsub.getTopics();

		// return data
		res.status(200).json(topics);
	} catch (err) {
		console.error(
			'ingest/topics/post',
			'failed to list topics',
			JSON.stringify({
				body: req.body,
				error: err.stack || err,
			})
		);
		return response.internalServerError(req, res, err);
	}
};
