const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

const uri = process.env.URI;
const client = new MongoClient(uri, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
	serverApi: ServerApiVersion.v1,
});

// Verify JWT
const verifyJWT = async (req, res, next) => {
	const authHeader = req.headers.authorization;
	if (!authHeader) {
		return res.status(401).send('Unauthorized Access.');
	}

	const token = authHeader.split(' ')[1];

	jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
		if (err) {
			return res.status(403).send('Forbidden Access');
		}
		req.decoded = decoded;
		next();
	});
};

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
	 * Authorization Start
	 */

	// Verify is the user Admin
	const verifyAdmin = async (req, res, next) => {
		const decodedEmail = req.decoded.email;

		const query = { email: decodedEmail };
		const user = await UsersCollection.findOne(query);
		if (user.role !== 'admin') {
			return res.status(403).send({ message: 'Forbidden Access.' });
		}
		next();
	};

	// Verify is the user Seller
	const verifySeller = async (req, res, next) => {
		const decodedEmail = req.decoded.email;

		const query = { email: decodedEmail };
		const user = await UsersCollection.findOne(query);
		if (user.role !== 'seller') {
			return res.status(403).send({ message: 'Forbidden Access.' });
		}
		next();
	};

	// Verify is the user Buyer
	const verifyBuyer = async (req, res, next) => {
		const decodedEmail = req.decoded.email;

		const query = { email: decodedEmail };
		const user = await UsersCollection.findOne(query);
		if (user.role !== 'buyer') {
			return res.status(403).send({ message: 'Forbidden Access.' });
		}
		next();
	};

	/**
	 * Authorization End
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
