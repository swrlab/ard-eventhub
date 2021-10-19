/*

	ard-eventhub
	by SWR audio lab

*/

module.exports = function (req, res) {
	try {
		return res.status(500).json({
			message: 'Internal Server Error',
			trace: req.headers['x-cloud-trace-context'] || null,
		})
	} catch (error) {
		return res.sendStatus(500)
	}
}
