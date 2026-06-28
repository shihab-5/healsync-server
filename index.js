const express = require('express')
const app = express()
const dotenv = require('dotenv')
const cors = require('cors')
dotenv.config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

app.use(cors())

// --- UPDATE THIS SECTION ---
// Increase the body parser limit to accommodate Base64 image payloads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
// ---------------------------

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

const run = async () => {
  try {
    const database = client.db("healsync");
    const doctorCollection = database.collection("doctors");
    const bookings = database.collection("bookings");

    app.post('/api/doctors', async (req, res) => {
      const newUser = req.body;
      const result = await doctorCollection.insertOne(newUser);
      console.log("new user", newUser);
      res.send(result);
    });

        app.get('/api/doctors',async(req,res)=>{
      const cursor=doctorCollection.find();
      const result=await cursor.toArray();
      res.send(result);

    })

app.get('/api/doctors/:id', async (req, res) => {
  try {
    const id = req.params.id;

    // Validate if the ID string is a legitimate 24-character hex string before converting
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ error: "Invalid hexadecimal ID format" });
    }

    const query = { _id: new ObjectId(id) };
    const doctor = await doctorCollection.findOne(query);

    if (!doctor) {
      return res.status(404).send({ error: "Doctor profile not found" });
    }

    res.send(doctor);
  } catch (error) {
    console.error("Database query crash:", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (err) {
    console.error(err);
  }
}

run().catch(console.dir);