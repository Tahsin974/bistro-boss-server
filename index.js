const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(`${process.env.PAYMENT_GATEWAY_SK}`);

const app = express();
const port = process.env.PORT || 5000;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.3lwmdbh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// middlewares
app.use(express.json());
app.use(cors());

// JWT token
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const database = client.db("BB_DATABASE");
    const menuCollection = database.collection("menu");
    const reviewCollection = database.collection("review");
    const cartCollection = database.collection("carts");
    const userCollection = database.collection("users");
    const paymentCollection = database.collection("payments");

    // ---------------JWT Related APIs---------------------
    // post APIs
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      // Token Generate
      const Token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "20h",
      });

      res.send({ Token });
    });

    // --------------------Middlewares----------------------
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send("Unauthorized Access 01");
      } else {
        const token = req.headers.authorization.split(" ")[1];

        jwt.verify(
          token,
          process.env.ACCESS_TOKEN_SECRET,
          function (err, decoded) {
            if (err) {
              return res.status(401).send("Unauthorized Access");
            }

            req.decoded = decoded;
            next();
          }
        );
      }
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;

      const query = { email: email };

      const user = await userCollection.findOne(query);

      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send("forbidden access");
      }
      next();
    };

    //---------------Menu Collection related APIs------------
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find({}).toArray();

      res.json(result);
    });

    //------------Review Collection related APIs-----------
    app.get("/review", async (req, res) => {
      const result = await reviewCollection.find({}).toArray();

      res.json(result);
    });

    //--------------Cart Collections related APIs------------
    // Get Api
    app.get("/carts", verifyToken, async (req, res) => {
      const email = req.query.email;
      if (email !== req.decoded.email) {
        return res.status(403).send("forbidden access");
      }
      const query = { customerEmail: email };
      const result = await cartCollection.find(query).toArray();

      res.json(result);
    });

    // Post Api
    app.post("/carts", verifyToken, async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);

      res.json(result);
    });
    // Delete Api
    app.delete("/carts/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.json(result);
    });

    //---------------Admin  Related APIs--------------------
    // Post APIs
    // add users after sign up
    app.post("/users", async (req, res) => {
      const userInfo = req.body;
      const query = { email: userInfo.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        res.send({ message: "user Already exists", insertedId: null });
      } else {
        const result = await userCollection.insertOne(userInfo);

        res.send(result);
      }
    });

    // add items on menu collection
    app.post("/menu", verifyToken, verifyAdmin, async (req, res) => {
      const menuItem = req.body;
      const result = await menuCollection.insertOne(menuItem);
      res.send(result);
    });

    // get APIs
    // get users from user collection
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find({}).toArray();
      res.json(result);
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(401).send("unauthorized access");
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    // get item from menu collection using id
    app.get("/menu/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await menuCollection.findOne(query);

      console.log(result);
      res.json(result);
    });

    // Delete Apis
    // delete user from userCollection
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // delete menu from menu collection
    app.delete("/menu/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });

    // Patch/Update Apis
    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.json(result);
      }
    );

    // update item
    app.patch(
      "/update-item/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const item = req.body;
        const updatedItem = {
          $set: {
            name: item.name,
            recipe: item.recipe,
            image: item.image,
            category: item.category,
            price: item.price,
          },
        };
        const result = await menuCollection.updateOne(filter, updatedItem);
        res.json(result);
      }
    );
    // PAYMENT Related APIs
    // create payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;

      const amount = parseInt(price * 100);

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      console.log(paymentIntent);

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // post APIs
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const userEmail = req.query.email;
      const paymentResult = await paymentCollection.insertOne(payment);

      const query = {
        _id: {
          $in: payment.cartIDs.map((id) => new ObjectId(id)),
        },
        customerEmail: userEmail,
      };
      const deletedResult = await cartCollection.deleteMany(query);

      res.send({ paymentResult: paymentResult, deletedResult: deletedResult });
    });

    // Get APIs
    app.get("/payment-history", verifyToken, async (req, res) => {
      const userEmail = req.query.email;
      const query = { email: userEmail };
      if (userEmail !== req.decoded.email) {
        return res.status(403).send("forbidden access");
      } else {
        const paymentHistoryResult = await paymentCollection
          .find(query)
          .toArray();
        return res.json(paymentHistoryResult);
      }
    });

    // Stats Related APIs

    app.get("/admin-stats", verifyToken, verifyAdmin, async (req, res) => {
      const userEmail = req.query.email;
      if (userEmail !== req.decoded.email) {
        return res.status(401).send("unauthorized access");
      }
      // menu items
      const menuItems = await menuCollection.estimatedDocumentCount();

      // Customers
      const query = { role: { $ne: "admin" } };
      const customers = await userCollection.countDocuments(query);

      // Orders
      const orders = await paymentCollection.estimatedDocumentCount();

      // Revenue

      /* 
      it is not a better option
      const options = {
        projection: { _id: 0, price: 1 },
      };
      const result = await paymentCollection.find({}, options).toArray();
      const revenue = result.reduce((totalPrice, item) => {
        return totalPrice + item.price;
      }, 0); */

      const revenuePipeline = [
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$price" },
          },
        },
      ];
      const result = await paymentCollection
        .aggregate(revenuePipeline)
        .toArray();
      const revenue = result.length > 0 ? result[0].totalRevenue : 0;

      res.send({
        menuItems: menuItems,
        customers: customers,
        orders: orders,
        revenue: revenue,
      });
    });

    // Order Stats
    app.get("/order-stats", verifyToken, verifyAdmin, async (req, res) => {
      // Aggregation pipeline
      const Pipeline = [
        // Step 1: Convert menuIDs to ObjectId (since they seem to be stored as strings)

        {
          $addFields: {
            menuIDs: {
              $map: {
                input: "$menuIDs",
                as: "menuID",
                in: { $toObjectId: "$$menuID" },
              },
            },
          },
        },
        // Step 2: Unwind the menuIDs array

        {
          $unwind: "$menuIDs",
        },
        // Step 3: Lookup menu items based on menuIDs

        {
          $lookup: {
            from: "menu",
            localField: "menuIDs",
            foreignField: "_id",
            as: "menuItems",
          },
        },
        // Step 4: Unwind the menuItems array (to handle the result of $lookup)
        {
          $unwind: "$menuItems",
        },
        // Step 5: Group by category and calculate total quantity and revenue
        {
          $group: {
            _id: "$menuItems.category",
            quantity: { $sum: 1 },
            revenue: { $sum: "$menuItems.price" },
          },
        },
        {
          $project: {
            _id: 0,
            category: "$_id",
            quantity: 1,
            revenue: 1,
          },
        },
      ];

      const userEmail = req.query.email;
      if (userEmail !== req.decoded.email) {
        return res.status(401).send("unauthorized access");
      }
      const result = await paymentCollection.aggregate(Pipeline).toArray();
      res.json(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    //   await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Welcome To Bistro Boss Restuarant Server");
});

app.listen(port, () => {
  console.log("Listening To The Port:", port);
});
