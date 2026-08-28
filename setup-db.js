const fs = require('fs');
const path = require('path');

// Find existing .db file or create new one
function getDbPath() {
    const files = fs.readdirSync('.', { recursive: true });
    for (const file of files) {
        if (typeof file === 'string' && file.endsWith('.db')) {
            const fullPath = path.resolve(file);
            console.log('Found existing database:', fullPath);
            return fullPath;
        }
    }
    // Create default location
    const dbDir = path.resolve('./database');
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    const dbPath = path.join(dbDir, 'products.db');
    console.log('Creating new database:', dbPath);
    return dbPath;
}

const dbPath = getDbPath();

// Try better-sqlite3 first (sync, easier), then sqlite3
let db;
try {
    const Database = require('better-sqlite3');
    db = new Database(dbPath);
    console.log('Using better-sqlite3');
} catch (e) {
    console.log('better-sqlite3 not found, trying sqlite3...');
    try {
        const sqlite3 = require('sqlite3').verbose();
        db = new sqlite3.Database(dbPath);
        console.log('Using sqlite3');
    } catch (e2) {
        console.error('ERROR: No SQLite package found.');
        console.error('Run this first: npm install better-sqlite3');
        console.error('Or: npm install sqlite3');
        process.exit(1);
    }
}

const isBetter = typeof db.prepare === 'function';

function run(sql, params = []) {
    if (isBetter) {
        db.prepare(sql).run(params);
    } else {
        db.run(sql, params, function(err) { if (err) console.error(err); });
    }
}

function all(sql, params = []) {
    if (isBetter) {
        return db.prepare(sql).all(params);
    }
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Create tables
console.log('Creating tables...');

run(`
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        colors TEXT,
        stock INTEGER DEFAULT 0,
        image_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

run(`
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT,
        customer_email TEXT,
        total_amount REAL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

run(`
    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        product_id INTEGER,
        quantity INTEGER DEFAULT 1,
        price_at_time REAL,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
    )
`);

console.log('Tables created: products, orders, order_items');

// Insert 10 realistic products
const products = [
    {
        name: 'Aura AI Smart Speaker',
        category: 'Smart Home',
        description: 'Voice-controlled speaker with GPT-powered assistant, 360-degree sound, and smart home hub integration.',
        price: 129.99,
        colors: 'Midnight Black, Pearl White, Space Gray',
        stock: 45,
        image_url: 'https://images.unsplash.com/photo-1589492477829-5e65395b66cc?w=400'
    },
    {
        name: 'NeuralCam 4K Security Camera',
        category: 'Security',
        description: 'AI-powered security camera with facial recognition, night vision, and real-time threat detection alerts.',
        price: 199.50,
        colors: 'White, Charcoal',
        stock: 32,
        image_url: 'https://images.unsplash.com/photo-1557324232-b8917d3c3dcb?w=400'
    },
    {
        name: 'CogniFit AI Fitness Band',
        category: 'Wearables',
        description: 'Smart fitness tracker with AI coaching, sleep analysis, stress monitoring, and 14-day battery life.',
        price: 89.00,
        colors: 'Graphite, Rose Gold, Ocean Blue',
        stock: 120,
        image_url: 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=400'
    },
    {
        name: 'DeepVision AR Glasses',
        category: 'AR/VR',
        description: 'Lightweight augmented reality glasses with AI object recognition, real-time translation, and navigation overlay.',
        price: 499.00,
        colors: 'Matte Black, Titanium Silver',
        stock: 18,
        image_url: 'https://images.unsplash.com/photo-1625314897518-bb4fe636e65f?w=400'
    },
    {
        name: 'SynthWave AI Keyboard',
        category: 'Accessories',
        description: 'Mechanical keyboard with AI auto-complete, smart macros, and per-key RGB with mood detection lighting.',
        price: 159.99,
        colors: 'Cyber Pink, Electric Blue, Stealth Black',
        stock: 67,
        image_url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400'
    },
    {
        name: 'EchoMind Noise-Canceling Headphones',
        category: 'Audio',
        description: 'Over-ear headphones with adaptive AI noise cancellation, spatial audio, and voice-isolation microphones.',
        price: 249.00,
        colors: 'Phantom Black, Cloud White, Sage Green',
        stock: 55,
        image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400'
    },
    {
        name: 'Lumina AI Desk Lamp',
        category: 'Smart Home',
        description: 'Smart desk lamp with circadian rhythm tracking, AI focus mode, and wireless phone charging base.',
        price: 79.95,
        colors: 'White, Black, Wood Grain',
        stock: 88,
        image_url: 'https://images.unsplash.com/photo-1534073828943-f801091a7d58?w=400'
    },
    {
        name: 'RoboClean AI Vacuum Pro',
        category: 'Home Appliances',
        description: 'Self-emptying robot vacuum with LiDAR mapping, pet hair detection, and AI obstacle avoidance.',
        price: 349.00,
        colors: 'White, Black',
        stock: 25,
        image_url: 'https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?w=400'
    },
    {
        name: 'NeuroPad AI Tablet',
        category: 'Tablets',
        description: '10.9-inch tablet with AI handwriting recognition, real-time note summarization, and neural drawing assist.',
        price: 429.99,
        colors: 'Silver, Space Gray, Rose Gold',
        stock: 40,
        image_url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400'
    },
    {
        name: 'PulseAI Health Monitor',
        category: 'Health',
        description: 'Non-invasive health monitor tracking blood oxygen, ECG, and hydration with AI-powered health insights.',
        price: 179.00,
        colors: 'Midnight, Arctic White',
        stock: 60,
        image_url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400'
    }
];

console.log('Inserting 10 products...');

const insert = isBetter 
    ? db.prepare(`INSERT INTO products (name, category, description, price, colors, stock, image_url) 
                  VALUES (?, ?, ?, ?, ?, ?, ?)`)
    : null;

for (const p of products) {
    if (isBetter) {
        insert.run(p.name, p.category, p.description, p.price, p.colors, p.stock, p.image_url);
    } else {
        run(`INSERT INTO products (name, category, description, price, colors, stock, image_url) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [p.name, p.category, p.description, p.price, p.colors, p.stock, p.image_url]);
    }
}

console.log('Products inserted successfully!');

// Verify
console.log('Verifying database contents...');

if (isBetter) {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Tables:', tables.map(t => t.name));
    
    const count = db.prepare('SELECT COUNT(*) as count FROM products').get();
    console.log('Total products:', count.count);
    
    const sample = db.prepare('SELECT * FROM products LIMIT 3').all();
    console.log('First 3 products:');
    sample.forEach(p => console.log(`  - ${p.name} ($${p.price}) [${p.stock} in stock]`));
    db.close();
    console.log('Setup complete! Phase 1 database is ready.');
} else {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
        if (err) throw err;
        console.log('Tables:', tables.map(t => t.name));
        
        db.get('SELECT COUNT(*) as count FROM products', [], (err, count) => {
            if (err) throw err;
            console.log('Total products:', count.count);
            
            db.all('SELECT * FROM products LIMIT 3', [], (err, sample) => {
                if (err) throw err;
                console.log('First 3 products:');
                sample.forEach(p => console.log(`  - ${p.name} ($${p.price}) [${p.stock} in stock]`));
                db.close();
                console.log('Setup complete! Phase 1 database is ready.');
            });
        });
    });
}