/*

	ard-eventhub
	by SWR audio lab

*/

// load pubsub for internal queues
const pubSubClient = require('./_client');

module.exports = async (newTopic) => {
	let name = newTopic.name;
	let metadata = {
		labels: { name: newTopic.label },
	};

	let result = pubSubClient.createTopic(name, function (err, topic, apiResponse) {
		if (!err) {
			// The topic was created successfully.
			console.log(`Topic ${name} was created.`);

			topic.setMetadata(metadata, (err) => {
				if (!err) {
					// The metadata was added successfully.
					console.log(`Metadata ${JSON.stringify(metadata)} was added to topic ${name}`);
				} else {
					console.error(err);
				}
			});
		} else {
			console.error(err);
		}
	});

	// return data
	return Promise.resolve(result);
};
