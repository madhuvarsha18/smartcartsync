import React, { useState, useEffect, useCallback } from 'react';
import { API } from './api';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';

function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('');
  const [token, setToken] = useState('');
  const [view, setView] = useState('login');
  const [items, setItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [restockInputs, setRestockInputs] = useState({}); // { [name]: amount }
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const [lowStock, setLowStock] = useState([]);
const [topProducts, setTopProducts] = useState([]);
const [restockSuggestions, setRestockSuggestions] = useState([]);
const [dashboardStats, setDashboardStats] = useState({});

  // ⬇️ Item form now supports image upload + preview
  const [itemForm, setItemForm] = useState({
    name: '',
    price: '',
    stock: '',
    imageFile: null,
    imagePreview: ''
  });

  // Save token
  const saveToken = (token, role) => {
    setToken(token);
    setRole(role);
    localStorage.setItem('token', token);
    localStorage.setItem('role', role);
  };

  const logout = () => {
    setUser(null);
    setRole('');
    setToken('');
    setView('login');
    localStorage.clear();
    setCart([]);
  };

  // Register
  const handleRegister = async () => {
    try {
      const res = await API.post('/auth/register', form);
      saveToken(res.data.token, form.role);
      setView(form.role === 'admin' ? 'admin' : 'home');
    } catch (err) {
      alert(err.response?.data?.msg || 'Error registering');
    }
  };

  // Login
  const handleLogin = async () => {
    try {
      const res = await API.post('/auth/login', { email: form.email, password: form.password });
      const decoded = JSON.parse(atob(res.data.token.split('.')[1]));
      setUser({ id: decoded.id, email: form.email, role: decoded.role }); // keep email
      saveToken(res.data.token, decoded.role);
      setView(decoded.role === 'admin' ? 'admin' : 'home');
    } catch (err) {
      alert(err.response?.data?.msg || 'Error logging in');
    }
  };

  // Fetch Items
  const fetchItems = useCallback(async () => {
    try {
      const res = await API.get('/items');
      setItems(res.data);
    } catch (err) {
      console.log(err);
    }
  }, []);

  // Admin add item (with image upload)
  const addItem = async () => {
    try {
      if (!itemForm.name || !itemForm.price || !itemForm.stock) {
        return alert('Please fill name, price and stock');
      }
      const fd = new FormData();
      fd.append('name', itemForm.name);
      fd.append('price', itemForm.price);
      fd.append('stock', itemForm.stock);
      if (itemForm.imageFile) fd.append('image', itemForm.imageFile);

      const res = await API.post('/items', fd, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      setItems(prev => [...prev, res.data]);
      setItemForm({ name: '', price: '', stock: '', imageFile: null, imagePreview: '' });
    } catch (err) {
      alert(err.response?.data?.msg || 'Error adding item');
    }
  };

  // Add to cart
  const addToCart = (item) => {
    const exists = cart.find(c => c.item._id === item._id);
    if (exists) {
      setCart(cart.map(c => c.item._id === item._id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { item, quantity: 1 }]);
    }
  };

  // Place order
  const placeOrder = async () => {
    if (!token) {
      alert("Please login first");
      return;
    }
    await fetch('http://localhost:5000/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail: user?.email || "guest",
        items: cart.map(c => ({
          name: c.item.name,
          price: c.item.price,
          quantity: c.quantity
        })),
        total: cart.reduce((acc, c) => acc + c.item.price * c.quantity, 0)
      })
    });
    setCart([]);
    if (role === 'admin') {
      fetchOrders();
      fetchItems();
      fetchPredictions();
    }
  };

  // Fetch orders (Admin)
  const fetchOrders = useCallback(async () => {
    try {
      const res = await API.get('/orders', { headers: { Authorization: `Bearer ${token}` } });
      setOrders(res.data);
    } catch (err) {
      console.log(err);
    }
  }, [token]);

  // Fetch restock predictions (Admin)
  const fetchPredictions = useCallback(async () => {
    try {
      const res = await API.get('/restock/predictions', { headers: { Authorization: `Bearer ${token}` } });
      setPredictions(res.data);
    } catch (err) {
      console.log(err);
    }
  }, [token]);

  useEffect(() => {
    fetchItems();
    if (role === 'admin') {
      fetchOrders();
    fetchItems();
    fetchPredictions();

    fetchLowStock();
    fetchTopProducts();
    fetchRestockSuggestions();
    fetchDashboardStats();
    }
  }, [role, fetchItems, fetchOrders, fetchPredictions]);

  // Admin: Complete order
  const completeOrder = async (orderId) => {
    try {
      await API.put(`/orders/${orderId}/complete`, {}, { headers: { Authorization: `Bearer ${token}` } });
      await Promise.all([fetchOrders(), fetchItems(), fetchPredictions()]);
    } catch (err) {
      alert(err.response?.data?.msg || 'Error completing order');
    }
  };

  // Admin: Delete order (permanent)
  const deleteOrder = async (id) => {
    try {
      await fetch(`http://localhost:5000/orders/${id}`, { method: "DELETE" });
      setOrders(prevOrders => prevOrders.filter(o => o._id !== id));
      fetchPredictions();
    } catch (error) {
      console.error("Error deleting order:", error);
    }
  };
  const fetchLowStock = async () => {
  const res = await fetch("http://localhost:5000/api/low-stock");
  const data = await res.json();
  setLowStock(data);
};

const fetchTopProducts = async () => {
  const res = await fetch("http://localhost:5000/api/top-products");
  const data = await res.json();
  setTopProducts(data);
};

const fetchRestockSuggestions = async () => {
  const res = await fetch("http://localhost:5000/api/restock-suggestions");
  const data = await res.json();
  setRestockSuggestions(data);
};

const fetchDashboardStats = async () => {
  const res = await fetch("http://localhost:5000/api/dashboard");
  const data = await res.json();
  setDashboardStats(data);
};
  // Admin: Restock item
  const restockItem = async (name) => {
    const amount = Number(restockInputs[name] || 0);
    if (!amount || amount <= 0) return alert('Enter a valid amount');
    try {
      await API.post('/restock', { name, amount }, { headers: { Authorization: `Bearer ${token}` } });
      setRestockInputs(prev => ({ ...prev, [name]: '' }));
      await Promise.all([fetchItems(), fetchPredictions()]);
    } catch (err) {
      alert(err.response?.data?.msg || 'Failed to restock');
    }
  };

  // Chart data
  const chartData = {
    labels: items.map(i => i.name),
    datasets: [{
      label: 'Stock Remaining',
      data: items.map(i => i.stock),
      backgroundColor: 'rgba(229,9,20,0.8)'
    }]
  };

  // ---------- Netflix-style CSS -------------
  const styles = {
    
    header: { fontSize: 32, marginBottom: 20, textAlign: 'center', color: '#E50914' },
    input: {
      display: 'block',
      margin: '10px 0',
      padding: 12,
      width: '100%',
      borderRadius: 5,
      border: 'none',
      outline: 'none',
      backgroundColor: '#333',
      color: '#fff'
    },
    
    list: { listStyleType: 'none', padding: 0 },
    
    orderBox: {
      marginBottom: 20,
      padding: 20,
      borderRadius: 8,
      backgroundColor: '#222'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      marginTop: 10
    },
    thtd: {
      borderBottom: '1px solid #333',
      padding: '10px'
    },
    badge: {
      backgroundColor: '#E50914',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 12,
      marginLeft: 8
    },
    section: { marginTop: 30},
    thumb: { width: 90, height: 90, objectFit: 'cover', borderRadius: 6, marginRight: 10, border: '1px solid #333' },
    row: { display: 'flex', alignItems: 'center', gap: 12 },
    container: {
    padding: 30,
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    maxWidth: 1000,
    margin: '0 auto',
    backgroundColor: '#141414',
    color: '#fff',
    minHeight: '100vh'
  },
  scrollRow: {
    
    display: 'flex',
    overflowX: 'auto',
    gap: '16px',
    paddingBottom: '10px',
    scrollbarWidth: 'none'
  },
  card: {
    minWidth: 180,
    maxWidth: 200,
    backgroundImage: 'linear-gradient(180deg, rgb(250, 244, 244) 0%, rgba(34,34,34,1) 100%)',
    borderRadius: 8,
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(238, 230, 201, 0.4)',
    flexShrink: 0
  },
  cardImage: {
    width: '100%',
    height: 140,
    objectFit: 'cover',
    borderBottom: '1px solid #333'
  },
  button: {
    padding: '10px 20px',
    margin: '5px',
    cursor: 'pointer',
    borderRadius: 5,
    backgroundColor: '#E50914',
    color: 'white',
    border: 'none',
    fontWeight: 'bold'
  },
  listItem: {
    backgroundImage: 'linear-gradient(90deg, rgb(226, 220, 220) 0%, rgba(20,20,20,1) 100%)',
    padding: '12px',
    boxShadow: '0 2px 8px rgba(14, 13, 10, 0.4)',
    borderRadius: '5px',
    margin: '5px 0'
  }
  };


  

  // ---------- Render Views -------------
  if (view === 'login' || view === 'register') {
    return (
      <div style={styles.container}>
        <h2 style={styles.header}>{view === 'login' ? 'Login' : 'Register'}</h2>
        {view === 'register' && (
          <input style={styles.input} placeholder="Name"
                 value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        )}
        <input style={styles.input} placeholder="Email"
               value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <input style={styles.input} type="password" placeholder="Password"
               value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        {view === 'register' && (
          <select style={styles.input} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        )}
        <button style={styles.button} onClick={view === 'login' ? handleLogin : handleRegister}>
          {view === 'login' ? 'Login' : 'Register'}
        </button>
        <p style={{ cursor: 'pointer', color: '#E50914', textDecoration: 'underline', marginTop: 10 }}
           onClick={() => setView(view === 'login' ? 'register' : 'login')}>
          {view === 'login' ? 'Register here' : 'Login here'}
        </p>
      </div>
    );
  }

  if (role === 'admin') {
    return (
      <div style={styles.container}>
        <h2 style={styles.header}>Admin Dashboard</h2>
        <button style={styles.button} onClick={logout}>Logout</button>

        {/* Add Item */}
        <div style={styles.section}>
          <h3>Add Item</h3>
          <input style={styles.input} placeholder="Name" value={itemForm.name}
                 onChange={e => setItemForm({ ...itemForm, name: e.target.value })} />
          <input style={styles.input} placeholder="Price" value={itemForm.price}
                 onChange={e => setItemForm({ ...itemForm, price: e.target.value })} />
          <input style={styles.input} placeholder="Stock" value={itemForm.stock}
                 onChange={e => setItemForm({ ...itemForm, stock: e.target.value })} />
          {/* Image picker + preview */}
          <div style={styles.row}>
            <input
              type="file"
              accept="image/*"
              style={{ ...styles.input, width: 'auto', padding: 8 }}
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) {
                  return setItemForm(prev => ({ ...prev, imageFile: null, imagePreview: '' }));
                }
                const reader = new FileReader();
                reader.onload = () => setItemForm(prev => ({ ...prev, imageFile: file, imagePreview: reader.result }));
                reader.readAsDataURL(file);
              }}
            />
            {itemForm.imagePreview && (
              <img src={itemForm.imagePreview} alt="preview" style={styles.thumb} />
            )}
          </div>
          <button style={styles.button} onClick={addItem}>Add Item</button>
        </div>

        {/* Stock Chart */}
        <div style={styles.section}>
          <h3>Stock Chart</h3>
          <Bar data={chartData} />
        </div>
         <div style={{padding:"20px",color:"black" ,background:"#f5f5f5", margin:"10px 0"}}>
  <h2>Business Insights</h2>

  <p>Total Orders: {dashboardStats.totalOrders}</p>
  <p>Total Revenue: ₹{dashboardStats.revenue}</p>
</div>
<div style={{padding:"20px", background:"#e81717", margin:"10px 0"}}>
  <h2>Low Stock Alerts</h2>

  {lowStock.map((item,index)=>(
    <p key={index}>
      {item.name} - {item.stock} left
    </p>
  ))}
</div>
<div style={{padding:"20px", background:"#ffffff",color:"black", margin:"10px 0"}}>
  <h2>Top Selling Products</h2>

  {topProducts.map((product,index)=>(
    <p key={index}>
      {index+1}. {product[0]} - {product[1]} sold
    </p>
  ))}
</div>
<div style={{padding:"20px", background:"#fe0404", margin:"10px 0"}}>
  <h2>AI Restock Suggestions</h2>

  {restockSuggestions.map((item,index)=>(
    <p key={index}>
      {item.product} → Add {item.recommendedRestock} units
    </p>
  ))}
</div>

        {/* Predictive Restock Assistant */}
        <div style={styles.section}>
          <h3>
            Restock Predictions
            <span style={styles.badge}>AI Assist</span>
          </h3>
          
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.thtd}>Item</th>
                <th style={styles.thtd}>Current Stock</th>
                <th style={styles.thtd}>Avg/Day (30d)</th>
                <th style={styles.thtd}>Days Left</th>
                <th style={styles.thtd}>Predicted Out</th>
                <th style={styles.thtd}>Restock +</th>
                <th style={styles.thtd}>Action</th>
              </tr>
            </thead>
           
            <tbody>
              {predictions.map(p => (
                <tr key={p.name} style={{ background: p.recommend ? '#1b1b1b' : '#222' }}>
                  <td style={styles.thtd}>
                    {p.name}
                    {p.recommend && <span style={styles.badge}>Low in ~{p.daysLeft}d</span>}
                  </td>
                  <td style={styles.thtd}>{p.currentStock}</td>
                  <td style={styles.thtd}>{p.avgPerDay}</td>
                  <td style={styles.thtd}>{p.daysLeft ?? '—'}</td>
                  <td style={styles.thtd}>{p.predictedOutDate ? new Date(p.predictedOutDate).toDateString() : '—'}</td>
                  <td style={styles.thtd}>
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      style={{ ...styles.input, width: 120, display: 'inline-block', margin: 0 }}
                      value={restockInputs[p.name] ?? ''}
                      onChange={e => setRestockInputs(prev => ({ ...prev, [p.name]: e.target.value }))}
                    />
                  </td>
                  <td style={styles.thtd}>
                    <button style={styles.button} onClick={() => restockItem(p.name)}>Restock</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Orders */}
        <div style={styles.section}>
          <h3>Orders</h3>
          {orders.map(order => (
            <div key={order._id} style={styles.orderBox}>
              <h3>User: {order.userEmail}</h3>
              <ul>
  {order.items.map((it, idx) => (
    <li key={idx} style={styles.row}>
      {it.image && (
        <img
          src={`http://localhost:5000${it.image}`}
          alt={it.name}
          style={styles.thumb}
        />
      )}
      {it.name} - {it.quantity} × ₹{it.price} = ₹{it.quantity * it.price}
    </li>
  ))}
</ul>

              <p><strong>Total:</strong> ₹{order.total}</p>
              <p>Status: {order.status}</p>
              {order.status === 'pending' && (
                <button style={styles.button} onClick={() => completeOrder(order._id)}>Mark as Completed</button>
              )}
              {order.status === 'completed' && (
                <span style={{ color: '#0f0', marginRight: '10px' }}>Completed</span>
              )}
              <button onClick={() => deleteOrder(order._id)} style={{ ...styles.button, backgroundColor: "red" }}>
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // User view
  return (
     <>
  
    <button style={styles.button} onClick={logout}>Logout</button>
    
    {/* Items section */}
    <div style={styles.section}>
      <h3 style={{ marginBottom: 10 }}>Best of our store!</h3>
      <div style={styles.scrollRow}>
        {items.map(i => (
          <div key={i._id} style={styles.card}>
            {i.image && (
              <img
                src={`http://localhost:5000${i.image}`}
                alt={i.name}
                style={styles.cardImage}
              />
            )}
            <div style={{ padding: '10px' }}>
              <h4 style={styles.cardTitle}>{i.name}</h4>
              <p style={styles.cardText}>₹{i.price}</p>
              <p style={styles.cardText}>Stock: {i.stock}</p>
              <button style={styles.button} onClick={() => addToCart(i)}>
                Add to Cart
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
    
    {/* Cart section */}
    <div style={styles.section}>
      <h3>Cart</h3>
      <ul style={styles.list}>
        {cart.map((c, idx) => (
          <li key={idx} style={styles.listItem}>
            {c.item.name} x {c.quantity} = ₹{c.item.price * c.quantity}
          </li>
        ))}
      </ul>
      <button style={styles.button} onClick={placeOrder}>Place Order</button>
    </div>
    
  </>
  );
  
}


export default App;
