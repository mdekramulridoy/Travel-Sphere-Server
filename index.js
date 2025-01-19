// server/index.js

const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
require("dotenv").config();
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
    // Get all users
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const users = await client
          .db("travelDb")
          .collection("users")
          .find()
          .toArray();
        res.send(users);
      } catch (err) {
        res.status(500).send({ message: "Error fetching users" });
      }
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

    // Check if user is admin
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const query = { email };
      const user = await userCollection.findOne(query);
      const admin = user?.role === "admin";
      res.send({ admin });
    });

    // Middleware for verifying specific role
    const verifyRole = (requiredRole) => {
      return async (req, res, next) => {
        try {
          const email = req.decoded.email;
          const user = await client
            .db("travelDb")
            .collection("users")
            .findOne({ email });
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

    // guide route add
    app.get(
      "/guideApplications",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const guideApplications = await client
            .db("travelDb")
            .collection("guideApplications")
            .find()
            .toArray();
          res.send(guideApplications);
        } catch (error) {
          console.error("Error fetching guide applications:", error);
          res
            .status(500)
            .send({ message: "Failed to fetch guide applications" });
        }
      }
    );

    // Get Guide Application Status for a Specific Email
    app.get(
      "/guideApplications/status/:email",
      verifyToken,
      async (req, res) => {
        try {
          const email = req.params.email;

          // Ensure the request is being made by the correct user
          if (email !== req.decoded.email) {
            return res.status(403).send({ message: "Forbidden access" });
          }

          const guideApplicationsCollection = client
            .db("travelDb")
            .collection("guideApplications");

          // Fetch the application with the given email
          const application = await guideApplicationsCollection.findOne({
            email,
          });

          if (!application) {
            return res
              .status(404)
              .send({ message: "No application found for this email." });
          }

          res.send({ status: application.status });
        } catch (error) {
          console.error("Error fetching guide application status:", error);
          res.status(500).send({ message: "Internal server error." });
        }
      }
    );

    // DELETE request handler for rejecting a guide application
    app.delete(
      "/guideApplications/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const applicationId = req.params.id;

        try {
          const guideApplicationsCollection = client
            .db("travelDb")
            .collection("guideApplications");

          // Update application status to 'rejected'
          const updatedApplication =
            await guideApplicationsCollection.updateOne(
              { _id: new ObjectId(applicationId) },
              { $set: { status: "rejected" } }
            );

          if (updatedApplication.matchedCount === 0) {
            return res.status(404).send({ message: "Application not found." });
          }

          res.send({ message: "Application rejected successfully." });
        } catch (err) {
          console.error("Error rejecting the application:", err);
          res.status(500).send({ message: "Internal server error." });
        }
      }
    );

    // Get All Guide Applications (Admin Only)
    app.patch(
      "/guideApplications/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const applicationId = req.params.id;
        const { status, email } = req.body; // Expecting status and email in the body

        if (!status || !email) {
          return res
            .status(400)
            .send({ message: "Status and email are required." });
        }

        try {
          const guideApplicationsCollection = client
            .db("travelDb")
            .collection("guideApplications");
          const userCollection = client.db("travelDb").collection("users");

          // Update application status
          const updatedApplication =
            await guideApplicationsCollection.deleteOne({
              _id: new ObjectId(applicationId),
            });

          if (updatedApplication.deletedCount === 0) {
            return res.status(404).send({ message: "Application not found." });
          }

          // Update user role
          const updatedUser = await userCollection.updateOne(
            { email },
            { $set: { role: "guide" } }
          );

          if (updatedUser.matchedCount === 0) {
            return res.status(404).send({ message: "User not found." });
          }

          res.send({ message: "Application approved and user role updated." });
        } catch (err) {
          console.error(
            "Error approving application and updating user role:",
            err
          );
          res.status(500).send({ message: "Internal server error." });
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
