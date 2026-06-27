const express = require('express')
const app = express()
const dotenv=require('dotenv')
const cors=require('cors')
dotenv.config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const port =process.env.PORT|| 5000;
app.use(cors())
app.use(express.json())

const uri = process.env.MONGODB_URI;


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

const run= async()=>{

  try {

    const database = client.db("healsync");
    const userCollection = database.collection("doctors");
    const bookings = database.collection("bookings");
    // const user=database.collection("user")
  

    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // await client.close();
  }

}

run().catch(console.dir)