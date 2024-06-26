const express = require('express');
const app = express()
const cors = require('cors');
require('dotenv').config()
const jwt = require('jsonwebtoken');

const stripe = require("stripe")(process.env.PAYMENT_SECRET);

const port = process.env.PORT || 5000

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

        const cartsCollection = client.db("BistroDB").collection("carts");
        const usersCollection = client.db("BistroDB").collection("users");
        const menusCollection = client.db("BistroDB").collection("menu");
        const paymentCollection = client.db("BistroDB").collection("payments");
        // apo jwt related
        app.post("/jwt", async (req, res) => {
            const user = req.body
            // console.log(user)
            const token = jwt.sign(user, process.env.ACCE_TOKEN, { expiresIn: "2h" })
            res.send({ token })
        })

        // verifytoken
        const verifyTOken = (req, res, next) => {
            const getToken = req.headers.authorization
            // console.log("token....hjhj.", getToken)
            if (!req.headers.authorization) {
                return res.status(401).send({ message: "unauthorize access" })
            }
            const token = req.headers.authorization.split(" ")[1]

            jwt.verify(token, process.env.ACCE_TOKEN, function (err, decoded) {
                if (err) {
                    return res.status(401).send({ message: "unauthorize access" })
                }
                req.decoded = decoded
                next()
            });

        }
        // admin verify
        const adminVerify = async (req, res, next) => {
            const email = req.decoded.email
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            const isAdmin = user?.role === "admin"
            if (!isAdmin) {
                return res.status(403).send({ message: "Forbiden access" })
            }
            next()
        }
        //  user verify
        app.get("/users/admin/:email", verifyTOken, async (req, res) => {
            const email = req.params.email
            // console.log("hhhhhhhh", email)
            if (email !== req?.decoded?.email) {
                return res.status(403).send({ message: "forbident.. access" })
            }
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            let isAdmin = false
            if (user) {
                isAdmin = user?.role === "admin"
            }
            res.send({ isAdmin })
        })
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
        app.get("/users", verifyTOken, adminVerify, async (req, res) => {
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
        // Get All Menu-------------------------
        app.get("/menu", async (req, res) => {
            const result = await menusCollection.find().toArray()
            res.send(result)
        })
        // delete menu
        app.delete("/menu/:id", async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await menusCollection.deleteOne(query)
            res.send(result)
        })
        // get a single menu
        app.get("/menu/:id", async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const result = await menusCollection.findOne(filter)
            console.log(result)
            res.send(result)
        })
        // update a single menu
        app.patch("/update_menu/:id", async (req, res) => {
            const id = req.params.id
            const item = req.body
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: { ...item }
            }
            const result = await menusCollection.updateOne(filter, updateDoc)
            res.send(result)
        })
        // save a menu
        app.post("/add_menu", verifyTOken, adminVerify, async (req, res) => {
            const item = req.body
            const result = await menusCollection.insertOne(item)
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





        // apyment intent-------------------------------------------------------
        app.post("/create-payment-intent", async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100)

            // Create a PaymentIntent with the order amount and currency
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
                payment_method_types: ["card"],
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        app.post("/payment", async (req, res) => {
            const payment = req.body
            const paymentResult = await paymentCollection.insertOne(payment)
            // delete carts item for each item
            const query = { _id: { $in: payment.cardIds.map(id => new ObjectId(id)) } }
            const deleteCards = await cartsCollection.deleteMany(query)

            res.send({ paymentResult, deleteCards })
        })
        app.get("/payment/:email", verifyTOken, async (req, res) => {
            const email = req.params.email
            const query = { email }
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "forbiden Access" })
            }
            const result = await paymentCollection.find(query).toArray()
            console.log(result)
            res.send(result)
        })
        // adminn ststs
        app.get("/adminStats", async (req, res) => {
            const totalMenus = await menusCollection.estimatedDocumentCount()
            const totalUsers = await usersCollection.estimatedDocumentCount()
            const totalOrders = await paymentCollection.estimatedDocumentCount()
            // total revenu
            const result = await paymentCollection.aggregate([
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: "$price" }
                    }
                }
            ]).toArray()
            const revenue = result.length > 0 ? result[0].totalRevenue : 0
            res.send({
                totalMenus,
                totalUsers,
                totalOrders,
                revenue
            })
        })

        // order ststs
        app.get("/orderStats",verifyTOken,adminVerify, async (req, res) => {
            const result = await paymentCollection
                .aggregate([
                    {
                        $unwind: "$menuIds",
                    },
                    {
                        $addFields: {
                            menuItemObjectId: { $toObjectId: "$menuIds" },
                        },
                    },
                    {
                        $lookup: {
                            from: "menu",
                            localField: "menuItemObjectId",
                            foreignField: "_id",
                            as: "menuItems",
                        },
                    },
                    {
                        $unwind:"$menuItems"
                    },
                    {
                        $group:{
                            _id:"$menuItems.category",
                            quantity:{$sum:1},
                            revenue:{$sum:"$menuItems.price"}
                        }
                    },
                    {
                        $project:{
                            _id:0,
                            category:"$_id",
                            quantity:"$quantity",
                            revenue:"$revenue"
                        }
                    }
                ])
                .toArray();
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