import { LoginTicket } from 'google-auth-library'
import { Request } from 'express'

export default interface UserTicketRequest extends Request {
	user? : LoginTicket
}
