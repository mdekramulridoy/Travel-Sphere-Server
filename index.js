const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const port = process.env.PORT || 5000;
const { ObjectId } = require("mongodb");

// Middleware
app.use(cors());
app.use(express.json());

// verify middleware
const verifyToken = (req, res, next) => {
  // console.log('inside verify token', req.headers.authorization);
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

// verify admin
const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const userCollection = client.db("travelDb").collection("users");
  const query = { email: email };
  const user = await userCollection.findOne(query);
  const isAdmin = user?.role === 'admin';
  if (!isAdmin) {
    return res.status(403).send({ message: 'forbidden access' });
  }
  next();
}





const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tvoho.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    // await client.connect();

    const userCollection = client.db("travelDb").collection("users");
    const packagesCollection = client.db("travelDb").collection("packages");
    const tourGuidesCollection = client.db("travelDb").collection("guides");

    // jwt api working here

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1hr",
      });
      res.send({ token });
    });

    // admin

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // user api
    app.get("/users", verifyToken,verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });


    // admin check
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    })




    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({
          message: "user already exist",
          insertedId: null,
        });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // Endpoint to fetch all packages
    app.get("/packages", async (req, res) => {
      const result = await packagesCollection.find().toArray();
      res.send(result);
    });

    // Endpoint to fetch a specific package by _id
    app.get("/packages/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await packagesCollection.findOne({ _id: id });
        if (result) {
          res.send(result);
        } else {
          res.status(404).json({ message: "Package not found" });
        }
      } catch (error) {
        res
          .status(500)
          .json({ message: "Error fetching package details", error });
      }
    });

    // Endpoint to fetch 3 random packages
    app.get("/random-packages", async (req, res) => {
      try {
        const randomPackages = await packagesCollection
          .aggregate([
            { $sample: { size: 3 } }, // Fetch 3 random packages
          ])
          .toArray();
        res.json(randomPackages);
      } catch (error) {
        res
          .status(500)
          .json({ message: "Error fetching random packages", error });
      }
    });

    // Endpoint to fetch all tour guides
    app.get("/guides", async (req, res) => {
      const result = await tourGuidesCollection.find().toArray();
      res.send(result);
    });

    // Endpoint to fetch 6 random tour guides
    app.get("/random-guides", async (req, res) => {
      try {
        const randomTourGuides = await tourGuidesCollection
          .aggregate([
            { $sample: { size: 6 } }, // Fetch 6 random tour guides
          ])
          .toArray();
        res.json(randomTourGuides);
      } catch (error) {
        res
          .status(500)
          .json({ message: "Error fetching random tour guides", error });
      }
    });

    // Endpoint to fetch a specific tour guide by _id
    app.get("/tour-guide-profile/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const guide = await tourGuidesCollection.findOne({
          _id: new ObjectId(id),
        });
        if (guide) {
          res.send(guide);
        } else {
          res.status(404).json({ message: "Tour guide not found" });
        }
      } catch (error) {
        res
          .status(500)
          .json({ message: "Error fetching tour guide profile", error });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}

run().catch(console.dir);

// Basic Route
app.get("/", (req, res) => {
  res.send("Travel Sphere is working");
});

// Start the server
app.listen(port, () => {
  console.log(`Travel Sphere is working on port ${port}`);
});
