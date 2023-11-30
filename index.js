const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const port = process.env.PORT || 5000;
require('dotenv').config()
const app = express()


// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',  
    // 'https://noxious-apples.surge.sh'
  ],
  credentials: true
}))
app.use(express.json())
app.use(cookieParser())


//Custom middleware 

const logger = (req, res, next) => {
  console.log('Log Info :', req.method, req.url);
  next();
}

const verfyToken = (req, res, next) => {
  const token = req.cookies?.token;
  console.log('token :', token)
  if (!token) {
    return res.status(401).send({ message: 'Unauthorized Access !' })
  }
  jwt.verify(token, process.env.secret, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: 'Forbidden Access !' })
    }
    else {
      req.user = decoded;
      next();
    }
  })
}



// home route

app.get('/', async (req, res) => {
  res.send('<h1 style="text-align:center; font-size:78px; margin-top:200px;" >WELCOME !!</h1>')
})


// Connect with db


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dhel08f.mongodb.net/?retryWrites=true&w=majority`;

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
    const availableFoods = client.db('FoodsDB').collection('AvailableFoods')
    const requestedFoods = client.db('FoodsDB').collection('RequestedFoods')

    //Auth Api's

    app.post('/jwt', async (req, res) => {
      const user = req.body;
      console.log(user)
      const token = jwt.sign(user, process.env.secret, { expiresIn: '1h' })
      res.
        cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production' ? true : false,
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
        })
        .send({ success: true })
    })

    app.post('/logout', async (req, res) => {
      const user = req.body;
      console.log("log out", user);
      res.clearCookie('token', {
        maxAge: 0,
        secure: process.env.NODE_ENV === 'production' ? true : false,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
      }).send({ success: true })
    })




    // DB Api's
    app.get('/availablefoods', async (req, res) => {
      const result = await availableFoods.find().sort({ 'date': 1 }).toArray();
      res.send(result)
    })

    app.get('/featuresfoods', async (req, res) => {
      const result = await availableFoods.find().sort({ 'quantity': -1 }).limit(6).toArray();
      res.send(result)
    })

    app.post('/availablefoods', async (req, res) => {
      const foodForm = req.body;
      const result = await availableFoods.insertOne(foodForm)
      res.send(result)
    })

    // user specific foods
    app.get('/managefood', async (req, res) => {
      const query = { email: req.query.email };
      const result = await availableFoods.find(query).toArray()
      res.send(result)
    })


    app.put('/managefood/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateReq = req.body;
      const updateDoc = {
        $set: {
          foodname: updateReq.foodname,
          photo: updateReq.photo,
          quantity: updateReq.quantity,
          location: updateReq.location,
          date: updateReq.date,
          message: updateReq.message
        }
      }

      const result = await availableFoods.updateOne(filter, updateDoc)
      res.send(result)
    })



    //food details api 
    app.get('/availablefoods/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await availableFoods.findOne(query);
      res.send(result);
    })




    app.delete('/availablefoods/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await availableFoods.deleteOne(query)
      res.send(result)
    })



    // Request food part
    app.get('/requestedfoods', logger, verfyToken, async (req, res) => {
      console.log('token info :', req.user)
      if (req.user.email !== req.query.email) {
        return res.status(403).send({ message: 'Forbidden Access !!' })
      }
      let query = {}
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await requestedFoods.find(query).toArray();
      res.send(result)
    })

    app.get('/requestedfoods/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id)
      const query = { fid: id };
      const result = await requestedFoods.find(query).toArray();
      res.send(result)
    })

    app.post('/requestedfoods', async (req, res) => {
      const requested = req.body;
      const result = await requestedFoods.insertOne(requested)
      res.send(result);
    })
    app.delete('/requestedfoods/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await requestedFoods.deleteOne(query)
      res.send(result)
    })

    app.patch('/requestedfoods/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateReq = req.body;
      const updateDoc = {
        $set: {
          status: updateReq.status
        }
      }
      const result = await requestedFoods.updateOne(filter, updateDoc);
      res.send(result)
    })


    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);






// App listen

app.listen(port, () => {
  console.log('Server runnig at ', port)
})