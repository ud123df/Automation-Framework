# ShopQA Premium — E-commerce QA Practice Application

A locally runnable full-stack demo store designed for manual QA, Playwright, API, SQL, and AI-assisted testing practice. The storefront uses a responsive editorial design; the backend provides REST endpoints, session authentication, and a SQLite database.

## Features

- Responsive storefront with search, category filtering, sorting, product detail views, and stock indicators
- Account registration, login, logout, server-side sessions, and a seeded QA demo account
- Persistent per-user shopping cart with quantity, stock, and empty-cart validation
- Checkout with contact/address validation and simulated UPI, card, and cash-on-delivery methods (no real payments)
- Order creation, inventory decrement, order history, and order detail endpoint
- REST API for products, authentication, cart, orders, health, and a protected inventory inspection endpoint
- SQLite schema and seed data created automatically on first run
- Stable test hooks (`data-testid`) and a small starter Playwright suite

## Requirements

- Node.js 18 or newer (Node 20 LTS recommended)
- npm

## Run locally

```bash
npm install
npm start
```

Open http://localhost:3000.

For auto-restart while developing:

```bash
npm run dev
```

The database files (`shopqa.sqlite`, `sessions.sqlite`) are generated locally on first run and are ignored by Git.

## QA demo account

- Email: `qa.demo@shopqa.test`
- Password: `ShopQA@123`

Admin API account (for role-based API testing):
- Email: `qa.admin@shopqa.test`
- Password: `ShopQAAdmin@123`

Use these accounts for local testing only. The app is a QA practice environment, not production-ready commerce software. Do not deploy it publicly with the default session secret or demo credentials. No actual payment processing occurs.

## REST API quick reference

| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| GET | `/api/health` | Health check | No |
| GET | `/api/products` | Search/filter/sort catalogue | No |
| GET | `/api/products/:id` | Product details | No |
| POST | `/api/auth/register` | Create account | No |
| POST | `/api/auth/login` | Sign in | No |
| POST | `/api/auth/logout` | Sign out | Session |
| GET | `/api/auth/me` | Current user | No |
| GET | `/api/cart` | Read cart | Yes |
| POST | `/api/cart` | Add item | Yes |
| PATCH | `/api/cart/:productId` | Change quantity | Yes |
| DELETE | `/api/cart/:productId` | Remove item | Yes |
| POST | `/api/orders` | Place demo order | Yes |
| GET | `/api/orders` | Order history | Yes |
| GET | `/api/orders/:id` | Order detail | Yes |
| GET | `/api/admin/orders` | All orders | Admin only |
| PATCH | `/api/admin/orders/:id/status` | Update order status | Admin only |
| GET | `/api/admin/products` | Inventory inspection | Admin only |

Prices are stored as integer paise in SQLite. Checkout calculates a 5% estimated tax and ₹99 shipping for subtotals below ₹1,500; shipping is complimentary at or above ₹1,500.

## Suggested end-to-end QA scenarios

1. Browse catalogue; search for an existing and a nonexistent product.
2. Filter by category and sort by price/rating.
3. Register a new account; attempt duplicate email and invalid inputs.
4. Log in with valid and invalid credentials.
5. Add a product to the cart, change quantity, remove it, and verify totals.
6. Try checkout with empty fields, invalid email, and invalid postal code.
7. Place an order using each simulated payment method; verify order history and inventory changes.
8. Call protected cart/order endpoints without a session and assert `401`.
9. Use SQL to inspect users, products, cart items, orders, and order items.
10. Run UI tests in Chromium and in headed mode.

## Notes

- Product photography is loaded from Unsplash; internet access is needed for those remote images. Store logic itself runs locally.
- Authentication uses hashed passwords and HTTP-only session cookies, but this is a training app. Before any public deployment, use a strong `SESSION_SECRET`, HTTPS, secure cookie settings, CSRF protection, rate limiting, and production security review.
