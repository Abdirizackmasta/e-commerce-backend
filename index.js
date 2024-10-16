const port = 4000;
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { types } = require("tar");
const bcrypt = require('bcrypt');
const app = express();

app.use(express.json());
app.use(cors());

// Database connection with MongoDB
mongoose.connect('mongodb+srv://abdirizackissack2018:Abdi112@cluster0.2sttw.mongodb.net/')
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.log('Error' + err));

// API creation
app.get('/', (req, res) => {
    res.send("Express app is running!");
});

// Ensure upload directory exists
const uploadDir = path.join(__dirname, './upload/images');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Image storage engine
const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
        cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage: storage });

// Creating upload endpoint for images
app.use('/images', express.static(uploadDir));
app.post('/upload', upload.single('product'), (req, res) => {
    res.json({
        success: 1,
        image_url: `http://localhost:${port}/images/${req.file.filename}`
    });
});

// schema for creating products
const Product = mongoose.model("product", {
    id: {
        type: Number,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    image: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    new_price: {
        type: Number,
        required: true,
    },
    old_price: {
        type: Number,
        required: true,
    },
    date: {
        type: Date,
        default: Date.now(),
    },
    available: {
        type: Boolean,
        default: true,
    }
})

app.post('/addproduct', async (req, res) => {
    let products = await Product.find({});
    let id;
    if (products.length > 0) {
        let last_product_array = products.slice(-1);
        let last_product = last_product_array[0];
        id = last_product.id + 1;
    } else {
        id = 1;
    }
    const product = new Product({
        id: id,
        name: req.body.name,
        image: req.body.image,
        category: req.body.category,
        new_price: req.body.new_price,
        old_price: req.body.old_price,
    })
    console.log(product);
    await product.save();
    console.log('saved product');
    res.json({
        success: true,
        name: req.body.name,
    })
})

// creating API for deleting product
app.post('/removeproduct', async (req, res) => {
    await Product.findOneAndDelete({ id: req.body.id });
    console.log('product removed');
    res.json({
        success: true,
        name: req.body.name
    })
})

// creating API for getting all products
app.get('/allproducts', async (req, res) => {
    let products = await Product.find({})
    console.log('all products fetched!')
    res.send(products)
})

// schema for creating users
const Users = mongoose.model('Users', {
    name: {
        type: String,
    },
    email: {
        type: String,
        unique: true,
    },
    password: {
        type: String,
    },
    cartData: {
        type: Object,
    },
    date: {
        type: Date,
        default: Date.now,
    }
})

// Creating endpoint for registering user
app.post('/signup', async (req, res) => {
    
    let check = await Users.findOne({ email: req.body.email });
    if (check) {
        res.status(400).json({success: false, errors: "Existing user found with the same email id!" })
    };
    const hashedPassword = await bcrypt.hash(req.body.password, 10)
    let cart = {};
    for (let i = 0; i < 300; i++) {
        cart[i] = 0;
    };

    const user = new Users({
        name: req.body.username,
        email: req.body.email,
        password: hashedPassword,
        cartData: cart,
    });
    await user.save();

    const data = {
        user: {
            id: user.id,
        }
    }
    const token = jwt.sign(data, 'secret_ecom');
    res.json({
        success: true,
        token,
    })
})

// creating endpoint for using login

app.post('/login', async (req, res) => {
    let user = await Users.findOne({ email: req.body.email });
    if (user) {
        const passCompare = await bcrypt.compare(req.body.password, user.password);
        if (passCompare) {
            const data = {
                user: user.id,
            }
            const token = jwt.sign(data, 'sercret-_com');
            res.json({
                success: true,
                token,
                }
            )
        } else {
            res.json({
                success: false,
                errors: 'Wrong password,'
            })
        }
    } else {
        res.json({
            success: false,
            errors: 'wrong email id',
        })
    }
})
// creating endpoint for newcollection data
app.get('/newcollections', async (req, res) => {
    let products = await Product.find({});
    let newcollection = products.slice(1).slice(-8);
    console.log("New collection fetched!");
    res.send(newcollection);
})
// creating endpoint for popular in women section
app.get('/popularinwomen', async (req, res) => {
    let products = await Product.find({category: "women"});
    let popularInWomen = products.slice(1).slice(0, 4);
    console.log("popular in women fetched!");
    res.send(popularInWomen);
})
// creating middleware to fetch user
const fetchUser = async (req, res, next) => {
    const token = req.header('auth-token');
    if (!token) {
        return res.status(401).send({ errors: "Please authenticate using a valid token!" });
    }
    try {
        const data = jwt.verify(token, 'secret_ecom');
        req.user = data.user;
        next();
    } catch (error) {
        res.status(401).send({ errors: "Please authenticate using a valid token!" });
    }
};

// creating endpoint for adding products in cart data
app.post('/addtocart', fetchUser, async (req, res) => {
    console.log("Added", req.body.itemId, req.user)
    let userData = await Users.findOne({ _id: req.user.id });
    userData.cartData[req.body.itemId] += 1;
    await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });
    res.send('Added!')
});
// creating endpoint to remove product from cart data
app.post('/removefromcart', fetchUser, async (req, res) => {
    console.log("Removed", req.body.itemId)
    let userData = await Users.findOne({ _id:req.user.id });
    if(userData.cartData[req.body.itemId]>0)
    userData.cartData[req.body.itemId] -= 1;
    await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });
    res.send('Removed!')
})

// creating endpoint to retrieve cart data
// app.post('/getcartdata', fetchUser, async (req, res) => {
//     console.log('Get Cart!');
//     let userData = await Users.findOne({ _id: req.user.id });
//     res.json(userData.cartData);
// })
// Start the server
app.listen(port, (error) => {
    if (!error) {
        console.log('Server running on port: ' + port);
    } else {
        console.log('Error: ' + error);
    }
});
