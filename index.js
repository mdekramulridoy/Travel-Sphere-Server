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
    const packageCollection = db.collection("packages");
    const bookingCollection = db.collection("bookings");
    const storyCollection = client.db("travelDb").collection("stories");

    // POST API to add a story
    app.post("/stories", verifyToken, async (req, res) => {
      try {
        const { title, text, images } = req.body;
        const email = req.decoded.email; // Email from the decoded JWT token

        if (!title || !text || !images || images.length === 0) {
          return res.status(400).send({ message: "All fields are required" });
        }

        const newStory = {
          title,
          text,
          images,
          email, // Attach user's email to the story
          createdAt: new Date(),
        };

        const result = await storyCollection.insertOne(newStory);
        res.status(201).send({
          message: "Story added successfully",
          storyId: result.insertedId,
        });
      } catch (error) {
        console.error("Error adding story:", error);
        res.status(500).send({ message: "Failed to add story" });
      }
    });

    // GET API to fetch all stories
    app.get("/stories", verifyToken, async (req, res) => {
      try {
        const email = req.decoded.email; // Logged-in user's email from JWT token
        const stories = await storyCollection.find({ email }).toArray(); // Fetch stories specific to the user
        res.send(stories);
      } catch (error) {
        console.error("Error fetching stories:", error);
        res.status(500).send({ message: "Failed to fetch stories" });
      }
    });

    // Get a specific story by ID
    app.get("/stories/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      try {
        const story = await storyCollection.findOne({ _id: new ObjectId(id) });
        if (!story) {
          return res.status(404).send({ message: "Story not found" });
        }
        res.send(story);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // DELETE API to delete a story by ID
    app.delete("/stories/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      try {
        const result = await storyCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 1) {
          res.send({ message: "Story deleted successfully" });
        } else {
          res.status(404).send({ message: "Story not found" });
        }
      } catch (error) {
        console.error("Error deleting story:", error);
        res.status(500).send({ message: "Error deleting story" });
      }
    });
    // Update a story: Remove a photo or add new photos
    app.patch("/stories/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const { removePhoto, addPhotos } = req.body; // Photos to remove and add
      const storyCollection = client.db("travelDb").collection("stories");

      try {
        const updateQuery = {};
        if (removePhoto) {
          updateQuery.$pull = { images: removePhoto };
        }
        if (addPhotos && addPhotos.length > 0) {
          updateQuery.$push = { images: { $each: addPhotos } };
        }

        const result = await storyCollection.updateOne(
          { _id: new ObjectId(id) },
          updateQuery
        );
        res.send(result);
      } catch (error) {
        console.error("Error updating story:", error);
        res.status(500).send({ message: "Error updating story" });
      }
    });

    // GET API to fetch stories for a specific user
    app.get("/stories/:email", verifyToken, async (req, res) => {
      const { email } = req.params;

      // Ensure the token's email matches the requested email for security
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      try {
        const stories = await storyCollection.find({ email }).toArray();
        res.send(stories);
      } catch (error) {
        console.error("Error fetching stories:", error);
        res.status(500).send({ message: "Error fetching stories" });
      }
    });

    // Booking Collection post
    app.post("/bookings", verifyToken, async (req, res) => {
      const bookingData = req.body;
      try {
        // Add booking to the collection
        const result = await bookingCollection.insertOne({
          ...bookingData,
          status: "pending", // Default status is pending
        });
        res.send({ insertedId: result.insertedId });
      } catch (error) {
        console.error("Error adding booking:", error);
        res.status(500).send({ message: "Error adding booking" });
      }
    });

    // API to get all bookings for a specific user
    app.get("/bookings/:email", verifyToken, async (req, res) => {
      const { email } = req.params;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      try {
        const bookingsCollection = client.db("travelDb").collection("bookings");
        const bookings = await bookingsCollection
          .find({ touristEmail: email })
          .toArray();
        res.send(bookings);
      } catch (error) {
        console.error("Error fetching bookings:", error);
        res.status(500).send({ message: "Error fetching bookings" });
      }
    });
    // Get bookings for a specific guide
    app.get("/bookings/guide/:email", verifyToken, async (req, res) => {
      const guideEmail = req.params.email;

      // Check if the logged-in user's email matches the requested guide's email
      if (guideEmail !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      try {
        const bookingsCollection = client.db("travelDb").collection("bookings");
        const bookings = await bookingsCollection
          .find({ guideEmail, status: "pending" })
          .toArray();

        res.send(bookings);
      } catch (error) {
        console.error("Error fetching guide bookings:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // Update booking status (confirm or reject)
    app.patch("/bookings/confirm/:id", verifyToken, async (req, res) => {
      const { id } = req.params; // Booking ID
      const { action } = req.body; // Action (confirm or reject)

      if (!id || !action) {
        return res
          .status(400)
          .send({ message: "Booking ID and action are required." });
      }

      if (!["confirm", "reject"].includes(action)) {
        return res
          .status(400)
          .send({ message: "Invalid action. Must be 'confirm' or 'reject'." });
      }

      try {
        const bookingsCollection = client.db("travelDb").collection("bookings");
        const result = await bookingsCollection.updateOne(
          { _id: new ObjectId(id) }, // Find the booking by ID
          { $set: { status: action } } // Update the status field
        );

        if (result.modifiedCount === 0) {
          return res
            .status(404)
            .send({ message: "Booking not found or already updated." });
        }

        res.send({ message: `Booking ${action}ed successfully.` });
      } catch (error) {
        console.error("Error updating booking status:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });
    // Delete a booking
    app.delete("/bookings/cancel/:id", verifyToken, async (req, res) => {
      const { id } = req.params; // Booking ID

      if (!id) {
        return res.status(400).send({ message: "Booking ID is required." });
      }

      try {
        const bookingsCollection = client.db("travelDb").collection("bookings");
        const result = await bookingsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Booking not found." });
        }

        res.send({ message: "Booking cancelled successfully." });
      } catch (error) {
        console.error("Error deleting booking:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // Add new package
    app.post("/packages", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const newPackage = req.body;
        const result = await packageCollection.insertOne(newPackage);
        res.send(result);
      } catch (error) {
        console.error("Error adding package:", error);
        res.status(500).send({ message: "Failed to add package" });
      }
    });

    // Get all packages
    app.get("/packages", async (req, res) => {
      try {
        const packages = await packageCollection.find().toArray();
        res.send(packages);
      } catch (error) {
        console.error("Error fetching packages:", error);
        res.status(500).send({ message: "Failed to fetch packages" });
      }
    });

    // Get a single package by ID
    app.get("/packages/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const package = await packageCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!package) {
          return res.status(404).send({ message: "Package not found" });
        }
        res.send(package);
      } catch (error) {
        console.error("Error fetching package:", error);
        res.status(500).send({ message: "Failed to fetch package" });
      }
    });

    // Update a package
    app.patch("/packages/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const updates = req.body;
        const result = await packageCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updates }
        );
        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Package not found" });
        }
        res.send({ message: "Package updated successfully" });
      } catch (error) {
        console.error("Error updating package:", error);
        res.status(500).send({ message: "Failed to update package" });
      }
    });

    // Delete a package
    app.delete("/packages/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const result = await packageCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Package not found" });
        }
        res.send({ message: "Package deleted successfully" });
      } catch (error) {
        console.error("Error deleting package:", error);
        res.status(500).send({ message: "Failed to delete package" });
      }
    });

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

    // Update existing user
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const { name, image, email: userEmail } = req.body;
      console.log("Incoming Data for PUT:", req.body);
      const filter = { email };
      const updateDoc = {
        $set: {
          name,
          photoURL: image,
          email: userEmail,
        },
      };
      const options = { upsert: true }; // Upsert enabled
      const result = await userCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    });

    // Guide api
    app.get("/guides", async (req, res) => {
      try {
        const guides = await client
          .db("travelDb")
          .collection("users")
          .find({ role: "guide" })
          .toArray();
        res.send(guides);
      } catch (err) {
        res.status(500).send({ message: "Error fetching guides" });
      }
    });
    // Fetch guide details by ID
    app.get("/guides/:id", async (req, res) => {
      const { id } = req.params;
      const guidesCollection = client.db("travelDb").collection("users");

      try {
        // Find the guide by ID in the database
        const guide = await guidesCollection.findOne({ _id: new ObjectId(id) });

        // Check if guide exists
        if (!guide) {
          return res.status(404).json({ message: "Guide not found" });
        }

        // Return the guide data
        res.json(guide);
      } catch (error) {
        console.error("Error fetching guide details:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    // Get random 6 guides
    app.get("/guides/random/6", async (req, res) => {
      try {
        const guides = await userCollection
          .aggregate([{ $match: { role: "guide" } }, { $sample: { size: 6 } }])
          .toArray();

        if (guides.length === 0) {
          return res.status(404).json({ message: "No guides found" });
        }

        res.json(guides);
      } catch (error) {
        console.error("Error fetching guides:", error);
        res
          .status(500)
          .json({ message: "Error fetching guides, please try again later" });
      }
    });

    // Get random 3 packages
    app.get("/packages/random/3", async (req, res) => {
      try {
        const packageCollection = client.db("travelDb").collection("packages");

        // Fetching 3 random packages using $sample aggregation
        const packages = await packageCollection
          .aggregate([{ $sample: { size: 3 } }])
          .toArray();

        if (packages.length === 0) {
          return res.status(404).json({ message: "No packages available" });
        }

        res.json(packages); // Send the fetched packages as a response
      } catch (error) {
        console.error("Error fetching packages:", error);
        res
          .status(500)
          .json({ message: "Error fetching packages, please try again later" });
      }
    });

    // Fetch random 4 stories
    app.get("/stories/random/4", verifyToken, async (req, res) => {
      try {
        const storiesCollection = client.db("travelDb").collection("stories");
        const stories = await storiesCollection
          .aggregate([
            { $sample: { size: 4 } }, // Randomly select 4 stories
          ])
          .toArray();

        res.send(stories);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Error fetching random stories" });
      }
    });
    // server/index.js

    // Get specific story by ID
    app.get("/story/:id", async (req, res) => {
      try {
        const storyId = req.params.id;
        const storiesCollection = client.db("travelDb").collection("stories");

        const story = await storiesCollection.findOne({
          _id: ObjectId(storyId),
        });
        if (!story) {
          return res.status(404).send({ message: "Story not found" });
        }

        res.send(story);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Error fetching story" });
      }
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
    // Route to fetch stats
    app.get("/admin/stats", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const userCollection = client.db("travelDb").collection("users");
        const packageCollection = client.db("travelDb").collection("packages");
        const storyCollection = client.db("travelDb").collection("stories");

        // Fetch total tour guides
        const totalTourGuides = await userCollection.countDocuments({
          role: "guide",
        });

        // Fetch total clients (tourists)
        const totalClients = await userCollection.countDocuments({
          role: "tourist",
        });

        // Fetch total packages
        const totalPackages = await packageCollection.countDocuments();

        // Fetch total stories
        const totalStories = await storyCollection.countDocuments();

        res.send({
          totalTourGuides,
          totalClients,
          totalPackages,
          totalStories,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
        res.status(500).send({ message: "Error fetching stats" });
      }
    });

    // server/index.js

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

    // guideApplication route add
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

    // Get GuideApplication Status for a Specific Email
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
