/*

	ard-eventhub
	by SWR audio lab

*/

// load pubsub for internal queues
const pubSubClient = require('./_client');

module.exports = async (newTopic) => {
	let topicId = newTopic.pubsub;
	let metadata = {
		labels: { name: newTopic.label },
	};

	return new Promise((resolve, reject) => {
		pubSubClient.createTopic(topicId, function (err, topic, apiResponse) {
			if (!err) {
				// The topic was created successfully.
				console.log(`Topic for "${newTopic.name}" was created`);

				topic.setMetadata(metadata, (err) => {
					if (!err) {
						// The metadata was added successfully.
						console.log(`Metadata ${JSON.stringify(metadata)} were added`);
					} else {
						reject(err);
					}
				});
			} else {
				reject(err);
			}
			// return response
			resolve(apiResponse);
		});
	});
};
