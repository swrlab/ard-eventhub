/*

	ard-eventhub
	by SWR audio lab

*/

const notFound = require('./notFound')
const badRequest = require('./badRequest')
const internalServerError = require('./internalServerError')
const ok = require('./ok')

module.exports = {
	notFound,
	badRequest,
	internalServerError,
	ok,
}
