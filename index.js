const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const {
  MongoClient,
  ServerApiVersion,
  ObjectId,
} = require("mongodb");

const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const uri = process.env.MONGO_URI;

/* ---------------- MongoDB ---------------- */

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

/* ---------------- JWKS ---------------- */

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
);

/* ---------------- JWT Middleware ---------------- */

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);

    // ✅ IMPORTANT FIX
    req.user = payload;

    next();
  } catch (error) {
    console.log("JWT ERROR:", error);
    return res.status(403).json({ message: "Forbidden" });
  }
};

/* ---------------- DATABASE INIT ---------------- */

async function run() {
  try {
    const db = client.db("wanderlustDB");

    const destinationCollection = db.collection("destinations");
    const bookingCollection = db.collection("bookings");

    /* ---------------- DESTINATIONS ---------------- */

    app.get("/featured", async (req, res) => {
      const result = await destinationCollection.find().limit(3).toArray();
      res.json(result);
    });

    app.get("/destinations", async (req, res) => {
      const result = await destinationCollection.find().toArray();
      res.json(result);
    });

    app.get("/destinations/:id", verifyToken, async (req, res) => {
      const { id } = req.params;

      const result = await destinationCollection.findOne({
        _id: new ObjectId(id),
      });

      res.json(result);
    });

    app.post("/destinations", verifyToken, async (req, res) => {
      const result = await destinationCollection.insertOne(req.body);
      res.json(result);
    });

    app.patch("/destinations/:id", async (req, res) => {
      const { id } = req.params;

      const result = await destinationCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: req.body }
      );

      res.json(result);
    });

    app.delete("/destinations/:id", verifyToken, async (req, res) => {
      const { id } = req.params;

      const result = await destinationCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.json(result);
    });

    /* ---------------- BOOKINGS ---------------- */

    app.post("/bookings", verifyToken, async (req, res) => {
      const booking = req.body;

      const result = await bookingCollection.insertOne(booking);

      res.json(result);
    });

    app.get("/bookings/:userId", async (req, res) => {
      const { userId } = req.params;

      const result = await bookingCollection.find({ userId }).toArray();

      res.json(result);
    });

    app.delete("/bookings/:bookingId", verifyToken, async (req, res) => {
      const { bookingId } = req.params;

      const result = await bookingCollection.deleteOne({
        _id: new ObjectId(bookingId),
      });

      res.json(result);
    });

    console.log("🚀 Server connected successfully");
  } catch (error) {
    console.error("DB ERROR:", error);
  }
}

run();

/* ---------------- ROOT ---------------- */

app.get("/", (req, res) => {
  res.send("Wanderlust server running 🚀");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});