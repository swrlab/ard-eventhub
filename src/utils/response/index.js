/*

	ard-eventhub
	by SWR Audio Lab

*/

const errors = require('./errors')
const notFound = require('./notFound')
const badRequest = require('./badRequest')
const internalServerError = require('./internalServerError')
const ok = require('./ok')

module.exports = {
	errors,
	notFound,
	badRequest,
	internalServerError,
	ok,
}
