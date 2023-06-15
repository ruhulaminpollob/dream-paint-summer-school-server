const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 5000;


app.use(cors());
app.use(express.json())



// varify jwt 

const verifyJWT= (req,res,next)=>{
  const authorization=req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({error:true, message:'Unauthorized Access'})
  }
  // bearer token-----------------
  const token=authorization.split(' ')[1]
  jwt.verify(token,process.env.SECRET_ACCESS_TOKEN, (error, decoded)=>{
    if (error) {
      return res.status(401).send({error:true, message:'Unauthorized Access'})
    }
    req.decoded =decoded
    next()

  })
}

app.get('/', (req, res) => {
  res.send("Don't move! Dream paint is now painting you")
})

// mongodb 


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uwz0znz.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
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



    const classesCollection = client.db("dreamPaintDB").collection("classes");
    const myClassesCollection = client.db("dreamPaintDB").collection("myClasses")
    const usersCollection = client.db("dreamPaintDB").collection('users')


    // JWT TOKEN  
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.SECRET_ACCESS_TOKEN, { expiresIn: '1h' })
      res.send({token})
    })
 

    // verify admin middleware ---------

    const verifyAdmin= async(req,res,next) =>{
      const email=req.decoded.email;
      const query ={email: email}
      const user =await usersCollection.findOne(query)
      if (user?.role !== 'Admin') {
        return res.status(403).send({error:true,message:'Forbidden Access'})
      }
      next()
    }
    // verify instructor middleware ---------

    const verifyInstructor= async(req,res,next) =>{
      const email=req.decoded.email;
      const query ={email: email}
      const user =await usersCollection.findOne(query)
      if (user?.role !== 'Instructor') {
        return res.status(403).send({error:true,message:'Forbidden Access'})
      }
      next()
    }
    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })
    //get single users data
    app.get('.user/:email', verifyJWT, async(req,res)=>{
      const email=req.params.email;
      const query={email: email}
      const result=await usersCollection.findOne(query)
      res.send(result)
    })

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query)
      if (existingUser) {
        return res.send({ message: "user already exist" })
      }
      const result = await usersCollection.insertOne(user);
      res.send(result)
    })

    // admin check ------------

    app.get('/user/admin/:email', verifyJWT, async(req,res)=>{
      const email=req.params.email;

      if (req.decoded.email !== email) {
        res.send({admin:false})
      }
      const query={email:email};
      const user=await usersCollection.findOne(query);
      const result={admin: user?.role === 'Admin'};
      res.send(result);
    })
    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          role: 'Admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updateDoc)
      res.send(result)
    })


    // instructor check ----------

    app.get('/users/instructor/:email', verifyJWT, async(req,res)=>{
      const email=req.params.email;

      if (req.decoded.email !== email) {
        res.send({instructor:false})
      }
      const query={email:email};
      const user=await usersCollection.findOne(query);
      const result={instructor: user?.role === 'Instructor'};
      res.send(result);
    })
    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          role: 'Instructor'
        }
      }
      const result = await usersCollection.updateOne(filter, updateDoc)
      res.send(result)
    })

    // delete users 

    app.delete('/users/:id', async (req, res) => {

      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query)
      res.send(result)
    })

    app.get("/classes", async (req, res) => {
      const filter={state:'approved'}
      const result = await classesCollection.find(filter).toArray()
      res.send(result)
    })
    app.post('/classes', verifyJWT, verifyInstructor, async(req,res)=>{
      const addClass=req.body;
      const result=await classesCollection.insertOne(addClass)
      res.send(result)
    })

    app.delete('/classes/:id', verifyJWT, verifyAdmin, async(req,res)=>{
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classesCollection.deleteOne(query)
      res.send(result)
    })


    app.get("/myclasses", verifyJWT, async (req, res) => {
      const email = req.query.email;
      // console.log(email);
      if (!email) {
        res.send([])
      };


      const decodedEmail=req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({error:true, message:'Forbidden Access'})
      }
      const query = { email: email }
      const result = await myClassesCollection.find(query).toArray()
      console.log(result)
      res.send(result)
    })

    app.get('/selected', async (req, res) => {

      const result = await myClassesCollection.find().toArray()
      res.send(result)
    })

    app.post('/myclasses', async (req, res) => {
      const myClass = req.body;
      // console.log(myClass)

      const query = { email: myClass.email, name: myClass.name }
      const isSelected = await myClassesCollection.find(query).toArray();

      if (isSelected.length > 0) {
        return res.send({ message: 'Class already selected' });
      }


      const result = await myClassesCollection.insertOne(myClass)
      res.send(result)

    })

    app.delete('/selected/:id', async (req, res) => {

      const id = req.params.id;
      console.log(id)
      const query = { _id: new ObjectId(id) };
      const result = await myClassesCollection.deleteOne(query)
      res.send(result)
    })







    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);








app.listen(port, () => {
  console.log(`Dream Paint is painting on PORT: ${port}`);

})