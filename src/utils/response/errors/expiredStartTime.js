/*

	ard-eventhub
	by SWR Audio Lab

*/

// load eventhub utils
const logger = require('../../logger')
const badRequest = require('../badRequest')

const source = 'utils.response.errors.expiredStartTime'

module.exports = (req, res) => {
	// log access attempt
	logger.log({
		level: 'notice',
		message: `User attempted event with expired start time ${req.body.start}`,
		source,
		data: {
			email: req.user.email,
			body: req.body,
		},
	})

	// return 400
	return badRequest(req, res, {
		message: 'request.body.start should be recent',
		errors: [
			{
				path: '.body.start',
				message: 'should not be expired event',
				errorCode: 'required.openapi.validation',
			},
		],
	})
}
