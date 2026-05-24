const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const cors = require('cors');
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const uri = process.env.MONGO_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const JWKS = createRemoteJWKSet((
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
))

const verifyToken = async (req, res, next)=> {
    const authHeader = req?.headers.authorization
    if(!authHeader) {
      return res.status(401).json({message : "Unauthorized"})
    }
    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({message : "Unauthorized"})
    }
    console.log(token)

    try {
       const { payload } = await jwtVerify(token, JWKS,)
       console.log(payload)
       next()
    } catch (error) {
      return res.status(403).json({message : "Forbidden"})
    }
   }

async function run() {
  try {
    // await client.connect();

   const db = client.db("wanderlustDB")
   const destinationCollection = db.collection("destinations");
   const bookingCollection = db.collection("bookings")

   app.get('/featured', async (req ,res)=> {
    const result = await destinationCollection.find().limit(3).toArray();
    res.json(result)
   })
   app.get('/destinations', async(req, res)=> {
    const result = await destinationCollection.find().toArray()
    res.json(result)
   })
   
   app.get('/destinations/:id',verifyToken, async (req, res)=> {
    const id = req.params.id;
    const query = {
      _id :  new ObjectId(id)
    }
    const result = await destinationCollection.findOne(query);
    res.send(result)
   })

   app.patch('/destinations/:id', async (req, res) => {
    const {id}= req.params;
    const updateData = req.body;
    const result = await destinationCollection.updateOne(
      {_id : new ObjectId(id)},
      {$set : updateData},
    )
    res.json(result)
   });

   app.delete('/destinations/:id',verifyToken, async (req, res) => {
    const id = req.params.id;
    const query = {
      _id : new ObjectId(id)
    }
    const result = await destinationCollection.deleteOne(query)
    res.send(result)
   })

   app.post('/destinations',verifyToken, async(req, res) => {
    const destinationData = req.body
    const result = await destinationCollection.insertOne(destinationData)
    res.json(result)
   });

   app.post('/bookings',verifyToken, async(req, res)=> {
    const bookingData = req.body
    const result = await bookingCollection.insertOne(bookingData);
    res.json(result)
   })

   app.get('/bookings/:userId', async (req, res) => {
    const {userId} = req.params;
    const result = await bookingCollection.find({userId:userId}).toArray();
    res.json(result)
   })

   app.delete('/bookings/:bookingId',verifyToken, async (req, res)=> {
    const {bookingId} = req.params;
    const query = {
      _id : new ObjectId(bookingId)
    }
    const result = await bookingCollection.deleteOne(query)
    res.json(result)
   })

    // await client.db("admin").command({ ping: 1 });

    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
  }
}

run();

app.get("/", (req, res) => {
  res.send("Wanderlust server is running");
});

app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});