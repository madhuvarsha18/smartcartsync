const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require("multer");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// ---------------- MongoDB Connection ----------------
mongoose.connect('mongodb://localhost:27017/smartcart', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.log(err));

// ---------------- Schemas ----------------
const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: { type: String, default: 'user' }
});

const ItemSchema = new mongoose.Schema({
  name: String,
  price: Number,
  stock: Number,
  image: String
});

const OrderSchema = new mongoose.Schema({
  userEmail: String,   // store user email instead of just user string
  items: [
    {
      name: String,
      price: Number,
      quantity: Number
    }
  ],
  total: Number,
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Item = mongoose.model('Item', ItemSchema);
const Order = mongoose.model('Order', OrderSchema);

// ---------------- Auth Routes ----------------
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashed, role });
    await user.save();
    const token = jwt.sign({ id: user._id, role: user.role }, 'secret', { expiresIn: '1d' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ msg: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id, role: user.role }, 'secret', { expiresIn: '1d' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Save to uploads folder
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // unique filename
  },
});

const upload = multer({ storage: storage });

// route to add item with image
app.post("/add-item", upload.single("image"), async (req, res) => {
  const { name, price, quantity } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : "";

  const newItem = new Item({ name, price, quantity, image });
  await newItem.save();
  res.json({ message: "Item added successfully" });
});

// serve uploads folder
app.use("/uploads", express.static(path.join(__dirname, "uploads")));


// route to add item with image
app.post("/api/items", upload.single("image"), async (req, res) => {
  try {
    const newItem = new Item({
      name: req.body.name,
      price: Number(req.body.price),
      stock: Number(req.body.stock),   // ✅ FIXED: use stock, not quantity
      image: req.file ? `/uploads/${req.file.filename}` : null,
    });
    await newItem.save();
    res.json(newItem);
  } catch (err) {
    res.status(500).json({ error: "Failed to add item" });
  }
});

// Create Order
app.post('/api/orders', async (req, res) => {
  try {
    const { userEmail, items, total } = req.body;

    // ✅ include image in order items
    const enrichedItems = await Promise.all(
      items.map(async (i) => {
        const dbItem = await Item.findOne({ name: i.name });
        return {
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          image: dbItem?.image || null   // ✅ attach image
        };
      })
    );

    const order = new Order({ userEmail, items: enrichedItems, total });
    await order.save();
    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: "Error creating order" });
  }
});

app.get("/api/items", async (req, res) => {
  try {
    const items = await Item.find();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch items" });
  }
});
app.delete("/api/items/:id", async (req, res) => {
  try {
    await Item.findByIdAndDelete(req.params.id);
    res.json({ message: "Item deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete item" });
  }
});

// ---------------- Order Routes ----------------
// Create Order


// Get all Orders
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Error fetching orders" });
  }
});

app.get("/api/restock-suggestions", async (req, res) => {
  const items = await Item.find();
  const orders = await Order.find();

  const suggestions = items.map(item => {
    let sold = 0;

    orders.forEach(order => {
      order.items.forEach(o => {
        if (o.name === item.name) {
          sold += o.quantity;
        }
      });
    });

    if (item.stock < sold) {
      return {
        product: item.name,
        recommendedRestock: sold - item.stock + 20
      };
    }

    return null;
  }).filter(x => x !== null);

  res.json(suggestions);
});

app.get("/api/top-products", async (req, res) => {
  const orders = await Order.find();
  const count = {};

  orders.forEach(order => {
    order.items.forEach(item => {
      count[item.name] = (count[item.name] || 0) + item.quantity;
    });
  });

  const sorted = Object.entries(count)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,5);

  res.json(sorted);
});

app.get("/api/low-stock", async (req,res)=>{
  const items = await Item.find({ stock: { $lt: 10 } });
  res.json(items);
});

app.get("/api/dashboard", async (req,res)=>{

 const orders = await Order.find();

 const totalOrders = orders.length;

 const revenue = orders.reduce((sum,o)=>sum+o.total,0);

 res.json({
   totalOrders,
   revenue
 });

});

// Delete Order (Permanent)
app.delete('/api/orders/:id', async (req, res) => {
  try {
    const deletedOrder = await Order.findByIdAndDelete(req.params.id);
    if (!deletedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json({ message: "Order deleted permanently" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting order" });
  }
});
// ---------------- Predictive Restock Assistant ----------------
// GET /api/restock/predictions
// Looks at the last 30 days of orders and predicts when each item will run out.
app.get('/api/restock/predictions', async (req, res) => {
  try {
    const DAYS = 30;
    const since = new Date();
    since.setDate(since.getDate() - DAYS);

    // Total quantity sold per item name in the last N days
    const sold = await Order.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.name', qtySold: { $sum: '$items.quantity' } } }
    ]);

    const salesMap = new Map();
    sold.forEach(s => salesMap.set(s._id, s.qtySold)); // total over N days

    const items = await Item.find();
    const today = new Date();

    const predictions = items.map(it => {
      const totalLastNDays = salesMap.get(it.name) || 0;
      const avgPerDay = totalLastNDays / DAYS; // average sold per day
      const daysLeft = avgPerDay > 0 ? (it.stock / avgPerDay) : Infinity;
      const predictedOutDate = isFinite(daysLeft)
        ? new Date(today.getTime() + Math.ceil(daysLeft) * 24 * 60 * 60 * 1000)
        : null;

      return {
        name: it.name,
        currentStock: it.stock,
        avgPerDay: Number(avgPerDay.toFixed(2)),
        daysLeft: isFinite(daysLeft) ? Math.ceil(daysLeft) : null,
        predictedOutDate,
        recommend: avgPerDay > 0 && it.stock <= avgPerDay * 7 // under a week left
      };
    });

    // Sort so urgent ones appear first
    predictions.sort((a, b) => {
      const aUrgency = a.daysLeft ?? Number.POSITIVE_INFINITY;
      const bUrgency = b.daysLeft ?? Number.POSITIVE_INFINITY;
      return aUrgency - bUrgency;
    });

    res.json(predictions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Failed to compute predictions' });
  }
});

// POST /api/restock
// Body: { name: string, amount: number }
app.post('/api/restock', async (req, res) => {
  try {
    const { name, amount } = req.body;
    const inc = Number(amount || 0);
    if (!name || !Number.isFinite(inc) || inc <= 0) {
      return res.status(400).json({ msg: 'Invalid name or amount' });
    }

    const item = await Item.findOne({ name });
    if (!item) return res.status(404).json({ msg: 'Item not found' });

    item.stock += inc;
    await item.save();
    res.json({ msg: 'Restocked', item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Failed to restock' });
  }
});


// Mark Order as Completed + Update Stock
app.put('/api/orders/:id/complete', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ msg: 'Order not found' });

    // Update stock for each item
    for (let i of order.items) {
      const item = await Item.findOne({ name: i.name });
      if (item) {
        item.stock = Math.max(item.stock - i.quantity, 0); // Prevent negative stock
        await item.save();
      }
    }

    order.status = 'completed';
    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});


// ---------------- Start Server ----------------
app.listen(5000, () => console.log('🚀 Server running on port 5000'));
