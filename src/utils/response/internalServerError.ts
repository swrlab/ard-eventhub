/*

	ard-eventhub
	by SWR Audio Lab

*/
import { Request, Response } from 'express'

export default (req: Request, res: Response, error?:any) => {
	try {
		return res.status(500).json({
			message: error.message || 'Internal Server Error',
			trace: req.headers['x-cloud-trace-context'] || null,
		})
	} catch (_error) {
		return res.sendStatus(500)
	}
}
