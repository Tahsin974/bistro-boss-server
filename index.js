const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config()


const app = express()
const port = process.env.PORT || 5000;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.3lwmdbh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
console.log(uri)


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
      await client.connect();
      const database = client.db("BB_DATABASE")
      const reviewCollection = database.collection('menu'); 
      const reviewCollections = database.collection('review'); 

      app.get('/menu' , async(req,res)=>{
        const result = await reviewCollection.find({}).toArray()
        
        res.json(result)
      })
      app.get('/review' , async(req,res)=>{
        const result = await reviewCollections.find({}).toArray()
        
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