const express = require('express');

const app = express();
const port = process.env.PORT || 5000;

app.get('/', async (req, res) => {
	res.send('The Server is running.');
});

app.listen(port, () => {
	console.log(`The server is running at port: ${port}`);
});
