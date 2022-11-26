const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = process.env.URI;
const client = new MongoClient(uri, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
	serverApi: ServerApiVersion.v1,
});

const run = async () => {
	const UsersCollection = client.db('Old-Is-Gold').collection('Users');

	app.get('/', async (req, res) => {
		res.send('The Server is running.');
	});

	/**
	 * Authentications Start
	 */
	// JWT Token
	app.get('/jwt', async (req, res) => {
		const email = req.query.email;
		const query = { email: email };
		const user = await UsersCollection.findOne(query);
		console.log(user);
		if (user) {
			const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, {
				expiresIn: '10d',
			});
			return res.send({ accessToken: token });
		}
		res.status(403).send({ accessToken: '' });
	});
	/**
	 * Authentications End
	 */

	/**
	 * Users Operations Start
	 */

	// Get All Users
	app.get('/users', async (req, res) => {
		const query = {};
		const users = await UsersCollection.find(query).toArray();
		res.send(users);
	});

	// Post a User
	app.post('/users', async (req, res) => {
		const user = req.body;
		const result = await UsersCollection.insertOne(user);
		res.send(result);
	});

	/**
	 * Users Operation Finished
	 */
};
run()
	.then(() => {})
	.catch((err) => {
		console.error(err.name, err.message, err.stack);
	});

app.listen(port, () => {
	console.log(`The server is running at port: ${port}`);
});
