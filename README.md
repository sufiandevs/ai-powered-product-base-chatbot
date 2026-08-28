# ai-powered-product-base-chatbot
# AI Product Shopping Chatbot 🤖🛒

A full-stack AI-powered ecommerce chatbot built with Node.js, SQLite, and OpenRouter (Llama 3.3).

## Features

- ✅ 10 AI & Smart Home products in database
- ✅ REST API for products, cart, and orders
- ✅ AI Shopping Assistant via OpenRouter (Llama 3.3 70B)
- ✅ AI can actually add items to cart when you ask
- ✅ Shopping cart with checkout
- ✅ Beautiful animated frontend

## Tech Stack

- **Backend:** Node.js + Express
- **Database:** SQLite (better-sqlite3)
- **AI:** OpenRouter API (meta-llama/llama-3.3-70b-instruct)
- **Frontend:** HTML + CSS + JavaScript (vanilla)

## Setup

1. Clone the repo
2. Run `npm install`
3. Create `.env` file (copy from `.env.example` and add your OpenRouter key)
4. Run `node setup-db.js` to create database + 10 products
5. Run `node server.js` to start backend
6. Open `index.html` in your browser

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | All products |
| GET | `/api/products/:id` | Single product |
| POST | `/api/chat` | AI assistant |
| POST | `/api/cart/add` | Add to cart |
| GET | `/api/cart` | View cart |
| POST | `/api/orders` | Checkout |

## Screenshots

(Add screenshots here after running)
