/*

	ard-eventhub
	by SWR Audio Lab

*/

import { Request, Response } from 'express'

export default (req: Request, res: Response, err: any) => {
	try {
		return res.status(err.status || 400).json({
			...err.data,
			message: err.message,
			errors: err.errors,
			trace: req.headers['x-cloud-trace-context'] || null,
		})
	} catch (_error) {
		return res.sendStatus(500)
	}
}
