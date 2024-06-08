const express = require('express')
const cors = require('cors')
const app = express()
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 5000

// midleware
app.use(cors())
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

    // jwt related API
    app.post('/jwt', async (req, res) => {
      const employe = req.body;
      const token = jwt.sign(employe, process.env.ACCESS_TOKEN, { expiresIn: '24hr' })
      res.send({ token })
    })

    // jwt middlewares 
    const verifyToken = (req, res, next) => {
      console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'forbiden access' })
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN, (error, decoded) => {
        if (error) {
          return res.status(401).send({ message: 'forbiden access' })
        }
        req.decoded = decoded;
        next()
      })

    }

    // employe realted api
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

    app.get('/employesData', verifyToken, async (req, res) => {
      const result = await employeCollection.find().toArray()
      res.send(result)
    })

    // make hr 
    app.patch('/employe/hr/:id', async (req, res) => {
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
    app.patch('/employe/:id', async (req, res) => {
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
