/*

	ard-eventhub
	by SWR audio lab

*/

module.exports = async (req, res) => {
	res.status(201).json({
		body: req.body,
		headers: req.headers
	})
};
