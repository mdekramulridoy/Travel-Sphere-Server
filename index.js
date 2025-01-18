// server/index.js

const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
require('dotenv').config();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tvoho.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Middleware for verifying JWT Token
const verifyToken = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized or expired token" });
    }
    req.decoded = decoded;
    next();
  });
};

// Middleware for verifying Admin Role
const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const userCollection = client.db("travelDb").collection("users");
  const user = await userCollection.findOne({ email });
  if (user?.role !== "admin") {
    return res.status(403).send({ message: "Forbidden access" });
  }
  next();
};

async function run() {
  try {
    const db = client.db("travelDb");
    const userCollection = db.collection("users");
    const guideApplicationsCollection = db.collection("guideApplications");

    // JWT API
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "24hr",
      });
      res.send({ token });
    });

    // Add new user (Tourist by default)
    app.post("/users", async (req, res) => {
      const { email, name, photoURL, role } = req.body;
      const query = { email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null });
      }

      const result = await userCollection.insertOne({
        email,
        name,
        photoURL: photoURL || null,
        role: role || "tourist",
      });
      res.send(result);
    });

    // Check user role
    app.get("/users/role/:email", verifyToken, async (req, res) => {
      try {
        const email = req.params.email;
        if (email !== req.decoded.email) {
          return res.status(403).send({ message: "Forbidden access" });
        }

        const user = await userCollection.findOne({ email });

        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }

        const role = user?.role || "tourist";
        return res.send({ role });
      } catch (error) {
        console.error("Error in fetching user role:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // Submit guide application
    app.post("/guideApplications", verifyToken, async (req, res) => {
      try {
        const application = req.body;
        application.status = "pending";
        const result = await guideApplicationsCollection.insertOne(application);
        res.send(result);
      } catch (error) {
        console.error("Error in submitting guide application:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

   // Middleware for verifying specific role
const verifyRole = (requiredRole) => {
  return async (req, res, next) => {
    try {
      const email = req.decoded.email;
      const user = await client.db("travelDb").collection("users").findOne({ email });
      if (!user || user.role !== requiredRole) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      next();
    } catch (error) {
      console.error("Role verification error:", error);
      res.status(500).send({ message: "Internal Server Error" });
    }
  };
};

// Updated routes
// Get all guide applications (Admin only)
app.get(
  "/guideApplications",
  verifyToken,
  verifyRole("admin"),
  async (req, res) => {
    try {
      const applications = await guideApplicationsCollection.find().toArray();
      res.send(applications);
    } catch (error) {
      console.error("Error in fetching guide applications:", error);
      res.status(500).send({ message: "Internal Server Error" });
    }
  }
);

// Approve or reject guide application (Admin only)
app.patch(
  "/guideApplications/:id",
  verifyToken,
  verifyRole("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const result = await guideApplicationsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } }
      );
      res.send(result);
    } catch (error) {
      console.error("Error in updating guide application:", error);
      res.status(500).send({ message: "Internal Server Error" });
    }
  }
);

// Promote user to guide (Admin only)
app.patch(
  "/users/promote/:email",
  verifyToken,
  verifyRole("admin"),
  async (req, res) => {
    try {
      const { email } = req.params;
      const result = await userCollection.updateOne(
        { email },
        { $set: { role: "guide" } }
      );
      res.send(result);
    } catch (error) {
      console.error("Error in promoting user to guide:", error);
      res.status(500).send({ message: "Internal Server Error" });
    }
  }
);


    // Connect to MongoDB and start server
    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error(err);
  }
}

run().catch(console.error);

app.listen(5000, () => {
  console.log("Server running on port", port);
});
