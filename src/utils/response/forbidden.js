/*

	ard-eventhub
	by SWR audio lab

*/

module.exports = function (req, res, err) {
	try {
		return res.status(403).json({
			message: `Forbidden (${err})`,
			trace: req.headers['x-cloud-trace-context'] || null,
		});
	} catch (err) {
		return res.sendStatus(403);
	}
};
