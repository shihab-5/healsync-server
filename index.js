const express = require('express')
const app = express()
const dotenv = require('dotenv')
const cors = require('cors')
dotenv.config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet } = require('jose-cjs')
const port = process.env.PORT || 5000;

// --- ADD THIS ---
// const dns = require('dns');
// dns.setServers(['8.8.8.8', '1.1.1.1']);
// ----------------

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
    const prescriptions = database.collection("prescriptions");


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

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ error: "Invalid hexadecimal ID format" });
    }

    const doctor = await doctorCollection.findOne({ _id: new ObjectId(id) });

    if (!doctor) {
      return res.status(404).send({ error: "Doctor profile not found" });
    }

    res.send(doctor);
  } catch (error) {
    console.error("Database query crash:", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

app.get("/api/doctors/user/:userId", async (req, res) => {
  const { userId } = req.params;

  const doctor = await doctorCollection.findOne({ userId });

  res.send(doctor);
});


app.patch('/api/doctors/:id', async (req,res)=>{
  // console.log("PATCH /api/doctors/:id called with params:", req.params, "and body:", req.body);
const {id}=req.params;
const {verificationStatus}=req.body; 
const result=await doctorCollection.updateOne(
  {userId: id},
  {$set:{verificationStatus}}
);
console.log("Update result:", result);
res.send(result);


})


// users

app.get('/user',async(req,res)=>{
      const cursor=user.find();
      const result=await cursor.toArray();
      res.send(result);

    })

app.patch('/user/:id', async (req, res) => {
  const {id} = req.params;
  const { status } = req.body; // "active" | "suspended"
  const allowedStatuses = ["active", "suspended"];

     if (!allowedStatuses.includes(status)) {
      return res.status(400).send({
        success: false,
        message: "Invalid status",
      });
    }
  const result = await user.updateOne(
    { _id: new ObjectId(id) },
    { $set: { status } }
  );
  res.send(result);
});


// appointments

app.post('/api/appointments', async (req, res) => {
  try {
    const {
      doctorId,
      doctorName,
      day,
      slot,
      symptoms,
      userEmail,
      consultationFee,
      patientId
    } = req.body;

    // 3. Insert, using the verified userId — not one trusted from the client body
    const result = await appointments.insertOne({
      doctorId,
      doctorName,
      day,
      slot,
      symptoms: symptoms || '',
      userEmail,
      patientId,
      consultationFee,
      appointmentStatus: 'pending',
      paymentStatus:'unpaid',
      createdAt: new Date(),
    });

    return res.status(201).json({
      message: 'Appointment created successfully',
      appointmentId: result.insertedId,
    });
  } catch (err) {
    console.error('Error creating appointment:', err);
    return res.status(500).json({ error: 'Failed to create appointment' });
  }
});


// GET a single appointment by id
app.get('/api/appointments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const appointment = await appointments.findOne({ _id: new ObjectId(id) });

    if (!appointment) {
      return res.status(404).send({ error: "Appointment not found" });
    }

    res.send(appointment);
  } catch (error) {
    console.error("Failed to fetch appointment:", error);
    res.status(500).send({ error: "Failed to fetch appointment" });
  }
});

// PATCH an appointment — accepts any subset of these fields
app.patch('/api/appointments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { appointmentStatus, paymentStatus, sessionId, transactionId } = req.body;

    const updateFields = {};
    if (appointmentStatus !== undefined) updateFields.appointmentStatus = appointmentStatus;
    if (paymentStatus !== undefined) updateFields.paymentStatus = paymentStatus;
    if (sessionId !== undefined) updateFields.sessionId = sessionId;
    if (transactionId !== undefined) updateFields.transactionId = transactionId;

    const result = await appointments.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    res.send(result);
  } catch (error) {
    console.error("Failed to update appointment:", error);
    res.status(500).send({ error: "Failed to update appointment" });
  }
});
//  app.post('/api/appointments', async (req, res) => {
//       const {   sessionId,
//                 doctorId,
//                 doctorName,
//                 day,
//                 slot,
//                 symptoms,
//                 userEmail,
//                 userId,
//                 consultationFee,
//                 status,
//                 transactionId,
//              } = req.body;

      // await appointments.insertOne({
      //   doctorId,
      //   doctorName,
      //   day,
      //   slot,
      //   symptoms,
      //   userEmail,
      //   userId,
      //   consultationFee,
      //  appointmentStatus:"pending" });

//       //  const paymentData = {
//       //   userId,
//       //   doctorId,
//       //   transactionId,
//       //   paidAt: new Date(),
//       //   consultationFee,
//       // }
//       // await paymentCollection.insertOne(paymentData);

//       // const result = await appointments.insertOne(newAppoint);
//       // console.log("new appointments", newAppoint);
//       res.send({ message: "Appointment created successfully" });
//     });

// POST a payment record
app.post('/api/payments', async (req, res) => {
  try {
    const { appointmentId, userId, doctorId, transactionId, consultationFee, sessionId } = req.body;

    const paymentData = {
      appointmentId: appointmentId || null,
      userId: userId || null,
      doctorId: doctorId || null,
      transactionId: transactionId || null,
      sessionId: sessionId || null,
      consultationFee: consultationFee || 0,
      paidAt: new Date(),
    };

    const result = await paymentCollection.insertOne(paymentData);
    res.send({ success: true, data: { ...paymentData, _id: result.insertedId } });
  } catch (error) {
    console.error("Failed to record payment:", error);
    res.status(500).send({ success: false, error: "Failed to record payment" });
  }
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
        console.log("PATCH /api/appointments/:id/status called with params:", req.params, "and body:", req.body);
        const {id}=req.params;
        const { appointmentStatus } = req.body; // "pending" | "confirmed" | "cancelled"
   
        const result= await appointments.updateOne(
          { _id: new ObjectId(id) },
          { $set: { appointmentStatus } }
        );
        res.send(result);
      });


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


//prescriptions

// GET all prescriptions (optionally filter by doctorId)
app.get('/api/prescriptions', async (req, res) => {
  const { doctorId, appointmentId, userId } = req.query;

  const filter = {};
  if (doctorId) filter.doctorId = doctorId;
  if (appointmentId) filter.appointmentId = appointmentId;
  if (userId) filter.userId = userId;

  const result = await prescriptions.find(filter).sort({ createdAt: -1 }).toArray();
  res.send(result);
});

// CREATE a prescription
app.post('/api/prescriptions', async (req, res) => {
  try {
    const data = req.body;
    const newPrescription = {
      patientName: data.patientName,
      userId: data.userId || null,
      doctorId: data.doctorId || null,
      appointmentId: data.appointmentId || null,
      date: data.date || new Date().toISOString().split("T")[0],
      diagnosis: data.diagnosis || "",
      medications: data.medications || [],
      notes: data.notes || "",
      createdAt: new Date().toISOString(),
    };
    const result = await prescriptions.insertOne(newPrescription);
    res.send({ success: true, data: { ...newPrescription, _id: result.insertedId } });
  } catch (error) {
    console.error("Failed to create prescription:", error);
    res.status(500).send({ success: false, error: "Failed to create prescription" });
  }
});

// UPDATE a prescription
app.patch('/api/prescriptions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const updateFields = {
      ...(data.patientName !== undefined && { patientName: data.patientName }),
      ...(data.diagnosis !== undefined && { diagnosis: data.diagnosis }),
      ...(data.medications !== undefined && { medications: data.medications }),
      ...(data.notes !== undefined && { notes: data.notes }),
      updatedAt: new Date().toISOString(),
    };

    const result = await prescriptions.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ success: false, error: "Prescription not found" });
    }

    const updated = await prescriptions.findOne({ _id: new ObjectId(id) });
    res.send({ success: true, data: updated });
  } catch (error) {
    console.error("Failed to update prescription:", error);
    res.status(500).send({ success: false, error: "Failed to update prescription" });
  }
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