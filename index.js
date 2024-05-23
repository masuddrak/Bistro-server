const express = require('express');
const app = express()
const port = process.env.PORT || 5000
const cors = require('cors');
require('dotenv').config()
const jwt = require('jsonwebtoken');

// midelware
app.use(cors())
app.use(express.json())

// database


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kaocfbi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
        const bristroCollection = client.db("BistroDB").collection("menu");
        const cartsCollection = client.db("BistroDB").collection("carts");
        const usersCollection = client.db("BistroDB").collection("users");
        // apo jwt related
        app.post("/jwt", async (req, res) => {
            const user = req.body
            console.log(user)
            const token = jwt.sign(user, process.env.ACCE_TOKEN, { expiresIn: "2h" })
            res.send({ token })
        })
        // verifytoken
        const verifyTOken = (req, res, next) => {
            const getToken = req.headers.authorization
            console.log("token....hjhj.",getToken)
            if (!req.headers.authorization) {
                return res.status(401).send({ message: "unauthorize access" })
            }
            const token = req.headers.authorization.split(" ")[1]

            jwt.verify(token, process.env.ACCE_TOKEN, function (err, decoded) {
                if(err){
                    return res.status(401).send({ message: "unauthorize access" })
                }
                req.decoded=decoded
                next()
            });
            
        }
        // create user role
        app.patch("/users/admin/:id", async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: { role: "admin" }
            }
            const result = await usersCollection.updateOne(filter, updateDoc)
            res.send(result)
        })
        // get all users
        app.get("/users", verifyTOken, async (req, res) => {
            const result = await usersCollection.find().toArray()
            res.send(result)
        })
        // delete user
        app.delete("/users/:id", async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await usersCollection.deleteOne(query)
            res.send(result)
        })
        //   create user info db
        app.post("/users", async (req, res) => {
            const user = req.body
            const query = { email: user?.email }
            const existUser = await usersCollection.findOne(query)
            if (existUser) {
                return res.status(401).send("You Have Accounte")
            }
            const result = await usersCollection.insertOne(user)
            res.send(result)
        })
        // Get All Menu
        app.get("/menu", async (req, res) => {
            const result = await bristroCollection.find().toArray()
            res.send(result)
        })
        // Post Cart
        app.post("/carts", async (req, res) => {
            const result = await cartsCollection.insertOne(req.body);
            res.send(result)
        })
        // get carts
        app.get("/carts", async (req, res) => {
            const email = req.query.email
            const result = await cartsCollection.find({ orderEmail: email }).toArray()
            res.send(result)
        })
        // delet cats items
        app.delete("/deleteCart/:id", async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await cartsCollection.deleteOne(query)
            res.send(result)
        })

        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);












app.get("/", async (req, res) => {
    res.send("Bistro is Runnig")
})
app.listen(port, () => {
    console.log(`Bistro is Runnig ${port}`)
})