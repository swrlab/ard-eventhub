/*

	ard-eventhub
	by SWR audio lab

*/

module.exports = (req, res, err) => {
	try {
		return res.status(err.status || 400).json({
			...err.data,
			message: err.message,
			errors: err.errors,
			trace: req.headers['x-cloud-trace-context'] || null,
		})
	} catch (error) {
		return res.sendStatus(500)
	}
}
