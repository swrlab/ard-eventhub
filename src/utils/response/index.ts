import badRequest from './badRequest.ts'
import errors from './errors/index.ts'
import internalServerError from './internalServerError.ts'
import notFound from './notFound.ts'
import ok from './ok.ts'

export { badRequest, errors, internalServerError, notFound, ok }

export default {
	errors,
	notFound,
	badRequest,
	internalServerError,
	ok,
}
