import { Request } from 'express'
import { DecodedIdToken } from 'firebase-admin/auth'

export default interface UserTokenRequest extends Request {
	user? : DecodedIdToken
}
