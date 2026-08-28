require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ==========================================
// DATABASE
// ==========================================
let DB_PATH = process.env.DB_PATH ? path.resolve(__dirname, process.env.DB_PATH) : path.join(__dirname, 'database', 'products.db');
if (!fs.existsSync(DB_PATH)) { console.error('DB not found:', DB_PATH); process.exit(1); }
const db = new Database(DB_PATH);
console.log('DB connected:', DB_PATH);

// Auto-create cart_items table if missing
db.prepare(`CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
)`).run();

// ==========================================
// PHASE 2: PRODUCT APIs
// ==========================================

app.get('/', (req, res) => {
    res.json({
        message: 'AI Product Shopping Chatbot API',
        phase: 4,
        endpoints: [
            'GET    /api/products',
            'GET    /api/products/:id',
            'GET    /api/products/category/:category',
            'GET    /api/categories',
            'POST   /api/chat',
            'POST   /api/cart/add       <-- NEW',
            'GET    /api/cart           <-- NEW',
            'DELETE /api/cart/:id       <-- NEW',
            'POST   /api/orders         <-- NEW'
        ]
    });
});

app.get('/api/products', (req, res) => {
    try { res.json({ success: true, data: db.prepare('SELECT * FROM products').all() }); }
    catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/products/:id', (req, res) => {
    try {
        const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
        if (!p) return res.status(404).json({ success: false, error: 'Product not found' });
        res.json({ success: true, data: p });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/products/category/:category', (req, res) => {
    try { res.json({ success: true, data: db.prepare('SELECT * FROM products WHERE category = ?').all(req.params.category) }); }
    catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/categories', (req, res) => {
    try { res.json({ success: true, data: db.prepare('SELECT DISTINCT category FROM products').all().map(r => r.category) }); }
    catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ==========================================
// PHASE 3: AI CHATBOT
// ==========================================

app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ success: false, error: 'Message required' });
        if (!process.env.OPENROUTER_API_KEY) return res.status(500).json({ success: false, error: 'API key missing' });

        let cartAction = '';
        let userMessage = message;

        // ===== DETECT "ADD TO CART" INTENT =====
        const lowerMsg = message.toLowerCase();
        if ((lowerMsg.includes('add') || lowerMsg.includes('buy') || lowerMsg.includes('put')) &&
            (lowerMsg.includes('cart') || lowerMsg.includes('bag'))) {

            // Find which product the user mentioned
            const products = db.prepare('SELECT id, name, category, price, stock FROM products').all();
            let matchedProduct = null;

            for (const p of products) {
                const shortName = p.name.toLowerCase().replace(/ai|smart|pro|mini|max/g, '').trim();
                if (lowerMsg.includes(p.name.toLowerCase()) ||
                    lowerMsg.includes(shortName) ||
                    lowerMsg.includes(p.category.toLowerCase())) {
                    matchedProduct = p;
                    break;
                }
            }

            if (matchedProduct) {
                // Actually add to database cart
                const existing = db.prepare('SELECT * FROM cart_items WHERE product_id = ?').get(matchedProduct.id);
                if (existing) {
                    db.prepare('UPDATE cart_items SET quantity = quantity + 1 WHERE product_id = ?').run(matchedProduct.id);
                } else {
                    db.prepare('INSERT INTO cart_items (product_id, quantity) VALUES (?, ?)').run(matchedProduct.id, 1);
                }
                cartAction = `SYSTEM NOTE: The user just asked to add "${matchedProduct.name}" to their cart. It has ALREADY been successfully added to the database cart. Confirm this politely and briefly. Do NOT say you cannot add items.`;
            } else {
                cartAction = `SYSTEM NOTE: The user asked to add something to cart but did not specify a clear product name. Ask them which product they want.`;
            }
        }

        // Build product context
        const products = db.prepare('SELECT id, name, category, price, stock FROM products').all();
        const context = products.map(p => `- ${p.name} (${p.category}): $${p.price}, ${p.stock} in stock`).join('\n');

        const messages = [
            { role: 'system', content: `You are a helpful shopping assistant.\nAvailable products:\n${context}\nOnly recommend from this list. Be concise.` }
        ];

        if (cartAction) {
            messages.push({ role: 'system', content: cartAction });
        }

        messages.push({ role: 'user', content: userMessage });

        // Call OpenRouter
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: 'meta-llama/llama-3.3-70b-instruct',
            messages: messages
        }, {
            headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'http://localhost:3000', 'X-Title': 'AI Chatbot' },
            timeout: 30000
        });

        res.json({ success: true, reply: response.data.choices[0].message.content });

    } catch (err) {
        console.error('Chat error:', err.response?.data || err.message);
        res.status(500).json({ success: false, error: err.response?.data?.error?.message || err.message });
    }
});

// ==========================================
// PHASE 4: CART + ORDERS
// ==========================================

// Add to cart
app.post('/api/cart/add', (req, res) => {
    try {
        const { product_id, quantity = 1 } = req.body;
        if (!product_id) return res.status(400).json({ success: false, error: 'product_id required' });

        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
        if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
        if (product.stock < quantity) return res.status(400).json({ success: false, error: 'Not enough stock' });

        const existing = db.prepare('SELECT * FROM cart_items WHERE product_id = ?').get(product_id);
        if (existing) {
            db.prepare('UPDATE cart_items SET quantity = quantity + ? WHERE product_id = ?').run(quantity, product_id);
        } else {
            db.prepare('INSERT INTO cart_items (product_id, quantity) VALUES (?, ?)').run(product_id, quantity);
        }

        res.json({ success: true, message: 'Added to cart' });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// View cart
app.get('/api/cart', (req, res) => {
    try {
        const items = db.prepare(`
            SELECT c.id as cart_item_id, c.quantity, p.id as product_id, p.name, p.price, p.image_url, (p.price * c.quantity) as subtotal
            FROM cart_items c JOIN products p ON c.product_id = p.id
        `).all();
        const total = items.reduce((sum, i) => sum + i.subtotal, 0);
        res.json({ success: true, items, total: total.toFixed(2), item_count: items.length });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// Remove from cart
app.delete('/api/cart/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM cart_items WHERE id = ?').run(req.params.id);
        res.json({ success: true, message: 'Removed from cart' });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// Create order
app.post('/api/orders', (req, res) => {
    try {
        const { customer_name, customer_email } = req.body;
        const cartItems = db.prepare('SELECT c.*, p.price, p.stock FROM cart_items c JOIN products p ON c.product_id = p.id').all();
        if (cartItems.length === 0) return res.status(400).json({ success: false, error: 'Cart is empty' });

        const total = cartItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);

        const orderResult = db.prepare('INSERT INTO orders (customer_name, customer_email, total_amount, status) VALUES (?, ?, ?, ?)')
            .run(customer_name || 'Guest', customer_email || '', total.toFixed(2), 'completed');
        const orderId = orderResult.lastInsertRowid;

        const insertItem = db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price_at_time) VALUES (?, ?, ?, ?)');
        const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');

        for (const item of cartItems) {
            insertItem.run(orderId, item.product_id, item.quantity, item.price);
            updateStock.run(item.quantity, item.product_id);
        }

        db.prepare('DELETE FROM cart_items').run();

        res.json({ success: true, order_id: orderId, total: total.toFixed(2), message: 'Order placed successfully' });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// 404
app.use((req, res) => res.status(404).json({ success: false, error: 'Route not found' }));

app.listen(PORT, () => {
    console.log('========================================');
    console.log('PHASE 4 SERVER RUNNING');
    console.log('http://localhost:' + PORT);
    console.log('========================================');
});
