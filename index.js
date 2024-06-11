const express = require('express')
const cors = require('cors')
const app = express()
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion, ObjectId, Admin } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 5000

// midleware
//Must remove "/" from your production URL
app.use(
  cors({
    origin: [
      "http://localhost:5173"
    ]
  })
);
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.eugjqa9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const employeCollection = client.db('associate-pulse').collection('employesData')
    const salaryPaidCollection = client.db('associate-pulse').collection('paidSalary')
    const contactCollection = client.db('associate-pulse').collection('contact')

    // jwt related API
    app.post('/jwt', (req, res) => {
      const employe = req.body;
      const token = jwt.sign(employe, process.env.ACCESS_TOKEN, { expiresIn: '1hr' })
      res.send({ token })
      // console.log(process.env.ACCESS_TOKEN);
    })

    // jwt middlewares 
    const verifyToken = (req, res, next) => {
      // console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' })
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN, (error, decoded) => {
        if (error) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next()
      })
    }

    // contact post
    app.post('/contact', async (req, res) => {
      const message = req.body
      const result = await contactCollection.insertOne(message)
      res.send(result)
    })
    // Check isAdmin 
    app.get('/user/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbiden access' })
      }
      const query = { email: email }
      const user = await employeCollection.findOne(query)
      let admin = false;
      if (user) {
        admin = user.role === 'Admin'
      }
      res.send({ admin })

    })
    // Check isHR 
    app.get('/user/hr/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbiden access' })
      }
      const query = { email: email }
      const user = await employeCollection.findOne(query)
      let hr = false;
      if (user) {
        hr = user.role === 'HR'
      }
      res.send({ hr })

    })


    // verifiy admin after verify token
    const verifiyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await employeCollection.findOne(query)
      const isAdmin = user?.role === 'Admin'
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbiden access' })
      }
      next()
    }
    // verifiy hr after verify token
    const verifiyHR = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await employeCollection.findOne(query)
      const isHR = user?.role === 'HR'
      if (!isHR) {
        return res.status(403).send({ message: 'forbiden access' })
      }
      next()
    }
    // contact get
    app.get('/all-contact', verifyToken, verifiyAdmin, async (req, res) => {
      const result = await contactCollection.find().toArray()
      res.send(result)
    })

    // employe entry realted api
    app.post('/employesData', async (req, res) => {
      const employe = req.body
      // check this email already in use
      const query = { email: employe.email }
      const existingUser = await employeCollection.findOne(query)
      if (existingUser) {
        return res.send({ message: 'user email already in use', insertedId: null })
      }
      const result = await employeCollection.insertOne(employe)
      res.send(result)
    })


    // salary payment and not duplicate payment for same month
    app.post('/employes/peyment', async (req, res) => {
      const payment = req.body
      // check this email already in use
      const query = { month: payment.month, email: payment.email }
      const existingMonth = await salaryPaidCollection.findOne(query)
      if (existingMonth) {
        return res.send({ message: 'Already Paid for this month', insertedId: null })
      }
      const result = await salaryPaidCollection.insertOne(payment)
      res.send(result)
    })


    // all employee data for admin
    app.get('/employesData', verifyToken, verifiyAdmin, async (req, res) => {
      const result = await employeCollection.find({ status: { $in: ['Verified', 'fired'] } }).toArray()
      res.send(result)
    })

    // all employee data for hr
    app.get('/myEmployess', verifyToken, verifiyHR, async (req, res) => {
      const result = await employeCollection.find().toArray()
      res.send(result)
    })

    // single employee details  for hr
    app.get('/details/:email', async (req, res) => {
      const id = req.params.email
      // console.log(id);
      const query = { email: email}
      const result = await employeCollection.findOne(query)
      res.send(result)
    })

    // single employee payment history  for employee
    app.get('/my-payment-history/:email', async (req, res) => {
      const email = req.params.email
      // console.log(email);
      const query = { email: email }
      // console.log(query);
      const result = await salaryPaidCollection.find(query).toArray()
      // console.log(result);
      res.send(result)
    })

    // make hr 
    app.patch('/employe/hr/:id', verifyToken, verifiyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role: 'HR'
        }
      }
      const result = await employeCollection.updateOne(query, updatedDoc);
      res.send(result)
    })

    // fire a employe from db
    app.patch('/employe/:id', verifyToken, verifiyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          status: 'fired'
        }
      }
      const result = await employeCollection.updateOne(query, updatedDoc)
      res.send(result)
    })
    // verify  a employe from db by hr
    app.patch('/myEmploye/hr/:id', verifyToken, verifiyHR, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          status: 'Verified'
        }
      }
      const result = await employeCollection.updateOne(query, updatedDoc)
      res.send(result)
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('associate-pulse is running')
})

app.listen(port, () => {
  console.log('Server is runnig on ', port);
})
