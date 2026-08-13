# UDYANA — uPVC Windows & Doors ERP

Full-stack ERP system for uPVC windows & doors manufacturing and sales. Built with React (TanStack Start) frontend and Python FastAPI + PostgreSQL backend.

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+ and [uv](https://docs.astral.sh/uv/getting-started/installation/)
- **PostgreSQL** 14+

## Quick Start

### 1. Setup Database

Create a PostgreSQL database:

```bash
createdb udyana
```

Or let the server auto-create it on first run.

### 2. Start Backend

```bash
cd server
uv sync                    # Install Python dependencies
uv run python start.py     # Creates DB, seeds admin, starts server on :8000
```

This automatically:
- Creates the `udyana` database if it doesn't exist
- Runs all table migrations
- Seeds the default admin user
- Starts the FastAPI server on `http://localhost:8000`

### 3. Start Frontend

```bash
# In a new terminal, from project root
npm install                # Install JS dependencies
npm run dev                # Starts dev server on :5173
```

Open `http://localhost:5173` in your browser.

### 4. Login

- **Username:** `admin`
- **Password:** `admin123`

Go to **Settings → Access Control** to create manager accounts.

## Manual Backend Start

If you prefer to run commands separately:

```bash
cd server
uv sync
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Creating the Admin User (Standalone Script)

```bash
cd server
uv run python scripts/create_admin.py
```

## Project Structure

```
├── src/                    # React frontend (TanStack Start)
│   ├── routes/             # Page components
│   ├── components/         # Reusable UI components
│   ├── lib/                # Utilities, API client, auth
│   └── hooks/              # React hooks
├── server/                 # Python backend (FastAPI)
│   ├── main.py             # App entry point
│   ├── models/             # SQLAlchemy ORM models
│   ├── schemas/            # Pydantic request/response schemas
│   ├── routers/            # API route handlers
│   ├── utils/              # Auth, permissions, helpers
│   ├── alembic/            # Database migrations
│   └── scripts/            # Setup scripts
└── package.json
```

## Roles & Permissions

| Role | Access |
|---|---|
| **Admin** | Full access to everything, can create managers |
| **Manager** | Access controlled per-module via permissions matrix |

Admin creates managers from **Settings → Access Control** and toggles module permissions (View, Create, Edit, Delete, Print, Export).

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/auth/login` | POST | Login, returns JWT |
| `/api/auth/signup` | POST | Create first admin |
| `/api/customers` | CRUD | Customer management |
| `/api/products` | CRUD | Product catalog |
| `/api/quotations` | CRUD | Quotation management |
| `/api/orders` | CRUD | Order management |
| `/api/invoices` | GET/DELETE | Invoice management |
| `/api/payments` | CRUD | Payment recording |
| `/api/expenses` | CRUD | Expense tracking |
| `/api/suppliers` | CRUD | Supplier management |
| `/api/purchases` | CRUD | Purchase management |
| `/api/inventory` | CRUD | Inventory tracking |
| `/api/settings` | GET/PUT | Company settings |
| `/api/users` | CRUD | User management (admin only) |
| `/api/permissions` | GET/PUT | Permission management |
| `/api/reports/*` | GET | Dashboard & reports |
| `/api/backup/*` | POST/GET/DELETE | Backup management |

## Tech Stack

**Frontend:** React 19, TanStack Router/Start, Tailwind CSS, shadcn/ui, Recharts, jsPDF  
**Backend:** Python 3.11+, FastAPI, SQLAlchemy (async), Alembic, asyncpg  
**Database:** PostgreSQL  
**Auth:** JWT (python-jose) + bcrypt
