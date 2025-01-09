const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config()


const app = express()
const port = process.env.PORT || 5000;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.3lwmdbh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


// middlewares
app.use(express.json())
app.use(cors())

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
      // await client.connect();
      const database = client.db("BB_DATABASE")
      const menuCollection = database.collection('menu'); 
      const reviewCollection = database.collection('review'); 
      const cartCollection = database.collection('carts'); 
      const userCollection = database.collection('users'); 
      
      // Menu Collection related apis
      app.get('/menu' , async(req,res)=>{
        
        const result = await menuCollection.find({}).toArray()
        
        res.json(result)
      })

        // Review Collection related apis
      app.get('/review' , async(req,res)=>{
        const result = await reviewCollection.find({}).toArray()
        
        res.json(result)
      })

      // Cart Collections related Apis
      // Get Api
      app.get('/carts' , async(req,res)=>{
        const email = req.query.email;
        console.log(email)
        const query = {customerEmail:email}
        const result = await cartCollection.find(query).toArray();
        
        res.json(result)
      })

      // Post Api
      app.post('/carts' , async(req,res)=>{
        const cartItem = req.body;
        const result = await cartCollection.insertOne(cartItem)
        
        res.json(result)
      })
      // Delete Api
      app.delete('/carts/:id',async(req,res)=>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)}
        const result =await cartCollection.deleteOne(query);
        res.json(result)
      })



      // User Collection  Related API
      // Post APIs
      app.post('/users', async(req,res) => {
        const userInfo = req.body;
        const query = {email: userInfo.email}
        const existingUser = await userCollection.findOne(query);
        if(existingUser){
          res.send({message:"user Already exists",insertedId:null} )
        }

        else{
          const result = await userCollection.insertOne(userInfo);

        res.send(result)
        }
      })


      // get APIs

      app.get('/users',async(req,res) => {
        const result = await userCollection.find({}).toArray()
        res.json(result)
      })


      // Delete Apis
      app.delete('/users/:id',async(req,res) =>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)}
        const result = await userCollection.deleteOne(query);
        res.send(result)
      })

      // Patch Apis
      app.patch('/users/admin/:id',async(req,res) =>{
        const id = req.params.id;
        const filter = {_id: new ObjectId(id)};
        const updatedDoc = {
          $set: {
            role:"admin"
          },
        };
        const result = await userCollection.updateOne(filter,updatedDoc);
        res.json(result)

      })
      
    } finally {
      // Ensures that the client will close when you finish/error
    //   await client.close();
    }
  }
  run().catch(console.dir);

app.get("/",(req,res) =>{
    res.send("Welcome To Bistro Boss Restuarant Server")
})

app.listen(port, ()=>{
    console.log("Listening To The Port:",port)
})