const express = require('express')
const app = express()
const dotenv = require('dotenv')
const cors = require('cors')
dotenv.config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet } = require('jose-cjs')
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

const JWKS=createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));


const verifyToken = async (req, res, next) => {
  const authHeader = req?.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user =payload;
    console.log(payload);
    next();
  } catch (error) {
    return res.status(403).json({ message: "Forbidden" });
  }
};


const adminVerifyToken = async (req, res, next) => {
const user = req.user;
if (user?.role!=="admin") {
  return res.status(403).json({ message: "Forbidden: Admin access required" });
}
next();
}
const doctorVerifyToken = async (req, res, next) => {
const user = req.user;
if (user?.role!=="doctor") {
  return res.status(403).json({ message: "Forbidden: doctor  access required" });
}
next();
}
const patientVerifyToken = async (req, res, next) => {
const user = req.user;
if (user?.role!=="patient") {
  return res.status(403).json({ message: "Forbidden: patient access required" });
}
next();
}


app.get('/', (req, res) => {
  res.send('Hello World!');
});



const run = async () => {
  try {
    const database = client.db("healsync");
    const doctorCollection = database.collection("doctors");
    const user = database.collection("user");
    const appointments = database.collection("appointments");
    const paymentCollection = database.collection("payments");
    const reviewCollection = database.collection("reviews");


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

   
// app.get('/api/doctors/:id', async (req, res) => {
//   try {
//     const id = req.params.id;
//     console.log("Received doctor ID:", id);

//     // Validate if the ID string is a legitimate 24-character hex string before converting
//     if (!ObjectId.isValid(id)) {
//       return res.status(400).send({ error: "Invalid hexadecimal ID format" });
//     }

//     const query = { _id: new ObjectId(id) };
//     console.log("Querying doctor with:", query);
//     const doctor = await doctorCollection.findOne(query);

//     if (!doctor) {
//       return res.status(404).send({ error: "Doctor profile not found" });
//     }

//     res.send(doctor);
//   } catch (error) {
//     console.error("Database query crash:", error);
//     res.status(500).send({ error: "Internal Server Error" });
//   }
// });

app.get("/api/doctors/:userId", async (req, res) => {
  const { userId } = req.params;

  const doctor = await doctorCollection.findOne({
    userId: userId,
  });

  if (!doctor) {
    return res.status(404).send({
      error: "Doctor not found",
    });
  }

  res.send(doctor);
});
app.get("/api/doctors/user/:userId", async (req, res) => {
  const { userId } = req.params;

  const doctor = await doctorCollection.findOne({ userId });

  res.send(doctor);
});

    app.get('/user',async(req,res)=>{
      const cursor=user.find();
      const result=await cursor.toArray();
      res.send(result);

    })


// appointments

 app.post('/api/appointments', async (req, res) => {
      const {   sessionId,
                doctorId,
                doctorName,
                day,
                slot,
                symptoms,
                userEmail,
                userId,
                consultationFee,
                status,
                transactionId,
             } = req.body;

      await appointments.insertOne({
        sessionId,
        doctorId,
        doctorName,
        day,
        slot,
        symptoms,
        userEmail,
        userId,
        consultationFee,
        transactionId, 
       appointmentStatus:"pending" });

       const paymentData = {
        userId,
        doctorId,
        transactionId,
        paidAt: new Date(),
        consultationFee,
      }
      await paymentCollection.insertOne(paymentData);

      // const result = await appointments.insertOne(newAppoint);
      // console.log("new appointments", newAppoint);
      res.send({ message: "Appointment created successfully" });
    });


        app.get('/api/appointments',async(req,res)=>{
      const cursor=appointments.find();
      const result=await cursor.toArray();
      res.send(result);

    })

    app.delete('/api/appointments/:id', async (req, res) => {
      const {id} = req.params;

      const result = await appointments.deleteOne({ _id: new ObjectId(id) });
      res.json({ message: "Appointment deleted successfully", result });})



app.patch('/api/appointments/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid appointment id' });
        }

        const { day, slot, symptoms } = req.body;
        const updateData = {};
        if (day) updateData.day = day;
        if (slot) updateData.slot = slot;
        if (symptoms !== undefined) updateData.symptoms = symptoms;

        const appointment = await appointments.findOne({ _id: new ObjectId(id) });
        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        // req.user comes from verifyToken's JWT payload
      

        const result = await appointments.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );
        res.json({ message: "Appointment updated successfully", result });
    } catch (error) {
        console.error("PATCH /api/appointments/:id crash:", error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


    // payments

    //  app.post('/api/payments', async (req, res) => {
    //   const {   sessionId,
    //             doctorId,
    //             doctorName,
    //             day,
    //             slot,
    //             symptoms,
    //             userEmail,
    //             userId,
    //             consultationFee,} = req.body;

    //   await appointments.insertOne({
    //     sessionId,
    //     doctorId,
    //     doctorName,
    //     day,
    //     slot,
    //     symptoms,
    //     userEmail,
    //     userId,
    //     consultationFee// Convert cents to dollars
    //   });
    //   // const result = await appointments.insertOne(newAppoint);
    //   // console.log("new appointments", newAppoint);
    //   res.send({ message: "Appointment created successfully" });
    // });
app.get('/api/payments',async(req,res)=>{
      const cursor=paymentCollection.find();
      const result=await cursor.toArray();
      res.send(result);
})



    // review
app.post('/api/reviews', async (req, res) => {
  const { patientId, doctorId, doctorName, rating, reviewText } = req.body;

  const result = await reviewCollection.insertOne({
    patientId,
    doctorId,
    doctorName,
    rating,
    reviewText,
    createdAt: new Date(),
  });

  res.send(result);
});

app.get('/api/reviews', async (req, res) => {
  const cursor = reviewCollection.find();
  const result = await cursor.toArray();
  res.send(result);
});

app.patch('/api/reviews/:id', async (req, res) => {
  const id = req.params.id;

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ error: "Invalid hexadecimal ID format" });
  }

  const { rating, reviewText } = req.body;

  const result = await reviewCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { rating, reviewText } }
  );

  res.send(result);
});

app.delete('/api/reviews/:id', async (req, res) => {
  const id = req.params.id;

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ error: "Invalid hexadecimal ID format" });
  }

  const result = await reviewCollection.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});

//user
app.patch('/user/:id', async (req, res) => {
  const id = req.params.id;
 
  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ error: "Invalid hexadecimal ID format" });
  }
 
  const { status } = req.body; // "active" | "suspended"
 
  const result = await user.updateOne(
    { _id: new ObjectId(id) },
    { $set: { status } }
  );
 
  res.send(result);
});
 
app.delete('/user/:id', async (req, res) => {
  const id = req.params.id;
 
  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ error: "Invalid hexadecimal ID format" });
  }
 
  const result = await user.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});



    // await client.connect();
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (err) {
    console.error(err);
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});