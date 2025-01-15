const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tvoho.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();

    const packagesCollection = client.db("travelDb").collection("packages");

    // Endpoint to fetch all packages
    app.get('/packages', async (req, res) => {
      const result = await packagesCollection.find().toArray();
      res.send(result);
    });

    // Endpoint to fetch 3 random packages
    app.get('/random-packages', async (req, res) => {
      try {
        const randomPackages = await packagesCollection.aggregate([
          { $sample: { size: 3 } } // Fetch 3 random packages
        ]).toArray();
        res.json(randomPackages);
      } catch (error) {
        res.status(500).json({ message: 'Error fetching random packages', error });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}

run().catch(console.dir);

// Basic Route
app.get('/', (req, res) => {
  res.send('Travel Sphere is working');
});

// Start the server
app.listen(port, () => {
  console.log(`Travel Sphere is working on port ${port}`);
});
