import type { Request } from 'express'
import type { DecodedIdToken } from 'firebase-admin/auth'

export default interface UserTokenRequest extends Request {
	user?: DecodedIdToken
}
