const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const { query } = require('express');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
	const CategoriesCollection = client
		.db('Old-Is-Gold')
		.collection('Categories');
	const ProductsCollection = client.db('Old-Is-Gold').collection('Products');
	const OrdersCollection = client.db('Old-Is-Gold').collection('Orders');
	const PaymentsCollection = client.db('Old-Is-Gold').collection('Payments');

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
	 * Payments Start
	 */
	// Payment Intents
	app.post('/create-payment-intent', async (req, res) => {
		const order = req.body;
		const price = parseFloat(order.resalePrice);
		const amount = price * 100;

		const paymentIntent = await stripe.paymentIntents.create({
			amount: amount,
			currency: 'usd',
			payment_method_types: ['card'],
		});

		res.send({
			clientSecret: paymentIntent.client_secret,
		});
	});

	app.post('/payments', async (req, res) => {
		const payment = req.body;
		const result = await PaymentsCollection.insertOne(payment);
		const id = payment.productID;
		const filter = { _id: ObjectId(id) };
		const updatedDoc = {
			$set: { sold: true, transactionID: payment.transactionID },
		};

		const updateResult = await ProductsCollection.updateOne(
			filter,
			updatedDoc
		);

		const query = { productID: payment.productID };
		const updateOrdersInfo = await OrdersCollection.updateMany(query, {
			$set: { sold: true },
		});

		res.send({ result, updateResult, updateOrdersInfo });
	});
	/**
	 * Payments End
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

	// Get All Seller
	app.get('/users/allSeller', verifyJWT, verifyAdmin, async (req, res) => {
		const query = { role: 'seller' };
		const users = await UsersCollection.find(query).toArray();
		res.send(users);
	});

	// Get All Buyer
	app.get('/users/allBuyer', verifyJWT, verifyAdmin, async (req, res) => {
		const query = { role: 'buyer' };
		const users = await UsersCollection.find(query).toArray();
		res.send(users);
	});

	// Post a User
	app.post('/users', async (req, res) => {
		const user = req.body;
		const query = { email: req.body.email };
		const foundUser = await UsersCollection.findOne(query);
		if (foundUser) {
			return res.send({ found: true, email: foundUser.email });
		}
		const result = await UsersCollection.insertOne(user);
		res.send(result);
	});

	// Delete a user
	app.delete('/users/:id', verifyJWT, verifyAdmin, async (req, res) => {
		const id = req.params.id;
		const query = { _id: ObjectId(id) };
		const result = await UsersCollection.deleteOne(query);
		res.send(result);
	});
	// Delete a user
	app.patch('/users/verify/:id', verifyJWT, verifyAdmin, async (req, res) => {
		const id = req.params.id;
		const query = { _id: ObjectId(id) };
		const options = { upsert: true };
		const updatedDoc = { $set: { verified: true } };
		const result = await UsersCollection.updateOne(
			query,
			updatedDoc,
			options
		);

		const sellerQuery = { sellerEmail: req.body.sellerEmail };
		const updateProducts = await ProductsCollection.updateMany(
			sellerQuery,
			updatedDoc,
			options
		);
		res.send(result);
	});

	// Check Whether a user is Admin or not.
	app.get('/users/admin/:email', async (req, res) => {
		const email = req.params.email;
		const query = { email: email };
		const user = await UsersCollection.findOne(query);
		res.send({ isAdmin: user?.role === 'admin' });
	});

	// Check Whether a user is Seller or not.
	app.get('/users/seller/:email', async (req, res) => {
		const email = req.params.email;
		const query = { email: email };
		const user = await UsersCollection.findOne(query);
		res.send({ isSeller: user?.role === 'seller' });
	});

	// Check Whether a user is Buyer or not.
	app.get('/users/buyer/:email', async (req, res) => {
		const email = req.params.email;
		const query = { email: email };
		const user = await UsersCollection.findOne(query);
		res.send({ isBuyer: user?.role === 'buyer' });
	});

	/**
	 * Users Operation End
	 */

	/**
	 * Categories Operation start
	 */

	// Get All Categories.
	app.get('/categories', async (req, res) => {
		const query = {};
		const categories = await CategoriesCollection.find(query).toArray();
		res.send(categories);
	});

	// Get products of the categories
	app.get('/categories/:id', async (req, res) => {
		const query = { categoryId: req.params.id, sold: false };
		const products = await ProductsCollection.find(query).toArray();
		res.send(products);
	});

	/**
	 * Categories Operation End
	 */

	/**
	 * Products Operation Start
	 */
	// Get All products of the user.
	app.get('/products/:email', verifyJWT, verifySeller, async (req, res) => {
		const query = { sellerEmail: req.params.email };
		const products = await ProductsCollection.find(query).toArray();
		res.send(products);
	});

	// Post product to the db
	app.post('/products', verifyJWT, verifySeller, async (req, res) => {
		let product = req.body;
		const seller = await UsersCollection.findOne({
			email: product.sellerEmail,
		});
		if (seller?.verified) {
			product = { ...product, verified: true };
		}
		const result = await ProductsCollection.insertOne(product);
		res.send(result);
	});

	// Get all Advertised Products
	app.get('/advertised', async (req, res) => {
		const query = { advertised: true, sold: false };
		const products = await ProductsCollection.find(query).toArray();
		res.send(products);
	});

	// Advertise a product.
	app.patch(
		'/products/advertised/:id',
		verifyJWT,
		verifySeller,
		async (req, res) => {
			const query = { _id: ObjectId(req.params.id) };
			const updatedDoc = { $set: { advertised: true } };
			const productUpdate = await ProductsCollection.updateOne(
				query,
				updatedDoc
			);
			// const productUpdate = await ProductsCollection.updateOne(query, updatedDoc,option)
			res.send(productUpdate);
		}
	);

	// Report a product
	app.patch('/products/report/:id', verifyJWT, async (req, res) => {
		const query = { _id: ObjectId(req.params.id) };
		const updatedDoc = { $set: { reported: true } };
		const productUpdate = await ProductsCollection.updateOne(
			query,
			updatedDoc
		);
		// const productUpdate = await ProductsCollection.updateOne(query, updatedDoc,option)
		res.send(productUpdate);
	});

	// Get all Reported products
	app.get('/products/reported', verifyJWT, async (req, res) => {
		const query = { reported: true };
		const products = await ProductsCollection.find(query).toArray();
		res.send(products);
	});

	// Delete Product
	app.delete('/products/:id', verifyJWT, async (req, res) => {
		const query = { _id: ObjectId(req.params.id) };
		const result = await ProductsCollection.deleteOne(query);
		res.send(result);
	});

	/**
	 * Products Operation End
	 */

	/**
	 * Order Start
	 */

	// Get all orders
	app.get('/orders', verifyJWT, verifyBuyer, async (req, res) => {
		const buyerEmail = req.query.email;
		const query = { buyerEmail: buyerEmail };
		const orders = await OrdersCollection.find(query).toArray();
		res.send(orders);
	});

	app.get('/orders/:id', async (req, res) => {
		const query = { _id: ObjectId(req.params.id) };
		const order = await OrdersCollection.findOne(query);
		res.send(order);
	});

	app.post('/orders', verifyJWT, verifyBuyer, async (req, res) => {
		const order = req.body;
		const query = {
			productID: order.productID,
			buyerEmail: order.buyerEmail,
		};
		const findResult = await OrdersCollection.findOne(query);
		if (findResult) {
			return res.send({ found: true });
		}
		const result = await OrdersCollection.insertOne(order);
		res.send(result);
	});

	/**
	 * Order End
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
