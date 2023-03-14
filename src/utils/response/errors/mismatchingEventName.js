/*

	ard-eventhub
	by SWR Audio Lab

*/

// load eventhub utils
const logger = require('../../logger')
const badRequest = require('../badRequest')

const source = 'utils.response.errors.mismatchingEventName'

module.exports = (req, res, eventName) => {
	// log access attempt
	logger.log({
		level: 'warning',
		message: 'User attempted event with mismatching names',
		source,
		data: {
			email: req.user.email,
			body: req.body,
			params: eventName,
		},
	})

	// return 400
	return badRequest(req, res, {
		message: 'request.body.event should match URL parameter',
		errors: [
			{
				path: '.body.event',
				message: 'should match URL parameter',
				errorCode: 'required.openapi.validation',
			},
		],
	})
}
