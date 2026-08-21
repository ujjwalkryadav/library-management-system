# 📚 Central University Library Management System

A complete, production-grade **Library Management System (LMS)** full-stack web application built with **Node.js, Express.js, EJS, Bootstrap 5, Vanilla JavaScript, and PostgreSQL (Prisma ORM)**.

---

## 🌟 Key Features

### 🛡️ 1. Authentication & Role-Based Access Control (RBAC)
* **Two Core Roles**: `ADMIN` (Librarian) and `STUDENT` (Library Patron).
* **Secure Session Auth**: `express-session` with HTTP-only cookies and bcrypt password hashing (cost factor 10).
* **Public Student Self-Registration**: Validates unique emails and unique Student ID/Roll numbers server-side.
* **Role Guards**: Strict middleware protection preventing cross-role access (e.g. students cannot access `/admin/*`).

### 📊 2. Admin & Librarian Operations
* **Dynamic Analytics Dashboard**:
  * Real-time KPI counter cards: Total Titles, Physical Copies, Available Copies, Active Loans, Overdue Loans, Total Students, Pending Requests, and Unpaid Overdue Fines.
  * **Interactive Chart.js Visualizations**: 6-month monthly circulation activity (Issues vs Returns) and Category breakdown doughnut chart.
* **Book Inventory Management (CRUD)**:
  * Add, edit, and archive book titles with ISBNs, publishers, publication year, shelf locations, and cover image uploads (via Multer).
  * Inventory constraints ensuring $0 \le \text{available\_copies} \le \text{total\_copies}$.
  * Deletion protection: Actively borrowed books cannot be deleted; books with transaction history are safely soft-archived.
* **Circulation & Loan Processing**:
  * Direct book issue form to active students with automated due date calculation from system policy.
  * Return processing in atomic PostgreSQL transactions (`prisma.$transaction`) with automated overdue day & fine calculations.
* **Request Approval Queue**:
  * Review student book reservations.
  * 1-Click Approve (atomically decreases available inventory, creates loan, computes due date, dispatches student alert).
  * Decline requests with custom rejection reasons.
* **Fine Ledger & Settlement**:
  * Filter fines by `UNPAID`, `PAID`, or `WAIVED`.
  * Settle fines as Paid with timestamp or waive fines.
* **Student Directory**:
  * Search by Name, Email, Student ID, Enrollment Number, or Department.
  * Full profile inspector with active loans, borrowing history, and fine ledger.
  * Instant Activate / Deactivate student account toggle.
* **Authors & Categories Management**:
  * Complete CRUD with relationship constraints preventing orphan records.
* **Configurable System Policies**:
  * Live configuration of Library Title, Maximum Books per Student, Loan Duration (Days), Fine Rate per Day ($), and Loan Renewal Limit.
* **Audit Transaction Logs**:
  * Filterable historical log of all book loan, renewal, and return events.

### 🎓 3. Student Self-Service Portal
* **Student Dashboard**:
  * Active loan countdown badges (e.g. `Due in 9 days`, `11 days Overdue` with pulsating warning).
  * Outstanding fine dues alert banner.
  * Pending reservation status tracker and unread system notifications.
* **Live Catalog & Search**:
  * Card-grid and detail view with cover photos, stock availability badges, and shelf locations.
  * Multi-criteria filters by Academic Discipline, Author, and Availability.
  * 1-Click "Request Book" button.
* **My Loans & Renewals**:
  * List of currently borrowed books with 1-click "Renew Loan" button (enforcing policy renewal limits).
* **Borrowing History**:
  * Complete history of returned books with return dates and fee settlements.
* **Fine Breakdown**:
  * Itemized ledger of all assessed overdue penalties.
* **Student Profile**:
  * View institutional credentials (Student ID, Department, Course, Semester) and update personal phone & address.
  * Secure password change.
* **Real-Time Notification Center**:
  * Top navigation badge with unread count.
  * Full inbox with AJAX "Mark as Read" actions for loan approvals, due alerts, and return receipts.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Backend Runtime** | Node.js (v18+) |
| **Web Framework** | Express.js 4.x |
| **Template Engine** | EJS (Embedded JavaScript) |
| **Database** | PostgreSQL |
| **ORM / Query Engine** | Prisma ORM 6.x |
| **Authentication & Security** | `express-session`, `bcryptjs`, `helmet`, `express-rate-limit`, `cookie-parser` |
| **File Uploads** | `multer` |
| **Frontend Styling** | Bootstrap 5.3, Bootstrap Icons, Google Fonts (Inter, Outfit) |
| **Client-Side Charts** | Chart.js 4.x |
| **Architecture** | MVC + Service Layer + Atomic Database Transactions |

---

## 📁 Project Structure

```
LIBRARY MANAGEMENT SYSTEM/
├── src/
│   ├── config/
│   │   ├── database.js          # Prisma client singleton & DB connection check
│   │   ├── session.js           # express-session configuration
│   │   └── settings.js          # Dynamic system policy manager & cache
│   ├── controllers/
│   │   ├── authController.js    # Sign in, student registration, password change
│   │   ├── adminController.js   # Admin dashboard, student directory, audit logs
│   │   ├── studentController.js # Student dashboard and profile
│   │   ├── bookController.js    # Catalog CRUD, filters, image uploads
│   │   ├── authorController.js  # Author CRUD
│   │   ├── categoryController.js# Category CRUD
│   │   ├── requestController.js # Book reservations & admin approvals
│   │   ├── issueController.js   # Loans, return processing, renewals
│   │   ├── fineController.js    # Fine ledger & settlements
│   │   ├── notificationController.js # Notification dispatch & read marks
│   │   └── settingController.js # System policies configuration
│   ├── middleware/
│   │   ├── auth.js              # Session context & flash alerts
│   │   ├── adminAuth.js         # Admin role guard
│   │   ├── studentAuth.js       # Student role guard
│   │   ├── upload.js            # Multer book cover upload middleware
│   │   ├── validation.js        # Input validation rules
│   │   └── errorHandler.js      # Central 400, 403, 404, 500 error pages
│   ├── routes/
│   │   ├── authRoutes.js        # /login, /register, /logout, /change-password
│   │   ├── adminRoutes.js       # /admin/*
│   │   ├── studentRoutes.js     # /student/*
│   │   ├── bookRoutes.js        # /books/*
│   │   ├── requestRoutes.js     # /requests/*
│   │   ├── issueRoutes.js       # /issues/*
│   │   ├── fineRoutes.js        # /fines/*
│   │   ├── notificationRoutes.js# /notifications/*
│   │   └── index.js             # Master router dispatcher
│   ├── services/
│   │   ├── authService.js       # User creation & credential verification
│   │   ├── bookService.js       # Inventory queries & stock safety
│   │   ├── issueService.js      # Atomic Prisma transactions for issue/return
│   │   ├── fineService.js       # Fine calculations & payments
│   │   ├── notificationService.js# Notification creation
│   │   └── reportService.js     # Dashboard metrics & Chart.js data
│   ├── utils/
│   │   ├── dateUtils.js         # Date formatting & overdue calculation
│   │   ├── pagination.js        # Reusable pagination helper
│   │   └── helpers.js           # Template view formatting helpers
│   ├── views/
│   │   ├── layouts/             # Base layouts (main, admin, student)
│   │   ├── partials/            # Head, navbar, sidebar, alerts, pagination, footer
│   │   ├── auth/                # Login, register, change password
│   │   ├── admin/               # Admin dashboard, books, students, requests, etc.
│   │   ├── student/             # Student dashboard, my books, history, fines, etc.
│   │   └── errors/              # 400, 403, 404, 500 error views
│   └── app.js                   # Express application setup & middleware pipeline
├── public/
│   ├── css/
│   │   ├── style.css            # Base typography & design tokens
│   │   ├── admin.css            # Admin sidebar & KPI cards
│   │   └── student.css          # Student banner & due badges
│   ├── js/
│   │   ├── main.js              # Global scripts & tooltip init
│   │   ├── admin.js             # Admin Chart.js charts
│   │   └── student.js           # Student AJAX handlers
│   ├── images/
│   │   ├── logo.svg             # University library SVG logo
│   │   └── default-cover.svg    # Fallback book cover
│   └── uploads/covers/          # Uploaded book cover images
├── prisma/
│   ├── schema.prisma            # Relational PostgreSQL schema
│   └── seed.js                  # Comprehensive database seed script
├── tests/
│   ├── test-workflow.js         # 27 end-to-end integration tests
│   └── test-routes.js           # 21 HTTP route & HTML render tests
├── .env.example                 # Environment variables template
├── .gitignore                   # Ignored files (node_modules, .env, uploads)
├── package.json                 # Project dependencies & scripts
├── server.js                    # Server entry point
└── README.md                    # Documentation
```

---

## ⚡ Quick Start Guide (Local Setup)

### 1. Prerequisites
Ensure you have the following installed on your computer:
* **Node.js**: v18.0.0 or later (`node -v`)
* **npm**: v9.0.0 or later (`npm -v`)
* **PostgreSQL**: PostgreSQL 14, 15, or 16 (`psql --version`)

---

### 2. Clone and Install Dependencies
```bash
git clone <your-repository-url>
cd "LIBRARY MANAGEMENT SYSTEM"
npm install
```

---

### 3. Configure Environment Variables
Copy `.env.example` to create your local `.env` file:
```bash
cp .env.example .env
```

Edit `.env` with your PostgreSQL credentials:
```env
PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/library_db?schema=public"
SESSION_SECRET="college-library-super-secret-key-2026-production"

DEFAULT_LOAN_DAYS=14
DEFAULT_FINE_PER_DAY=5.00
DEFAULT_MAX_BOOKS=3
DEFAULT_RENEWAL_LIMIT=2
```

---

### 4. Setup Database Schema & Seed Data
Create the database in PostgreSQL if it doesn't already exist:
```bash
createdb -U postgres library_db
```

Push the Prisma schema to create all tables, enums, relations, and indexes:
```bash
npm run prisma:push
```

Seed the database with initial Categories, Authors, Books, Admin, Students, Active Loans, and Fines:
```bash
npm run seed
```

---

### 5. Run Integration Tests
Verify all business rules, transactions, and HTTP routes with the test suites:
```bash
# Run business logic & transaction tests (27 test cases)
npm run test:workflow

# Run route & HTML template tests (21 test cases)
node tests/test-routes.js
```

---

### 6. Start the Web Application
```bash
# Start development server with live reload
npm run dev

# Or start standard production server
npm start
```

Open your browser and navigate to: **`http://localhost:3000`**

---

## 🔐 Default Demo Accounts

| Role | Email Address | Password | Permissions |
|---|---|---|---|
| **Chief Librarian (Admin)** | `admin@library.local` | `ChangeThisPassword123!` | Full Admin Panel, Book CRUD, Approvals, Returns, Fines, Settings |
| **Student 1 (Alex Sharma)** | `student1@college.edu` | `Student123!` | Student Portal, Catalog, Book Requests, Loan Renewals, Fines |
| **Student 2 (Priya Patel)** | `student2@college.edu` | `Student123!` | Student Portal, Active Loans |
| **Student 3 (Rahul Verma)** | `student3@college.edu` | `Student123!` | Student Portal |

> *Note: These accounts are for development and testing. Always change passwords before production deployment.*

---

## ☁️ Deployment Guide (GitHub & Render.com)

This application is designed following 12-factor cloud standards and is 100% ready for one-click deployment to **Render.com**.

### Step 1: Push to GitHub
1. Initialize git repository:
   ```bash
   git init
   git add .
   git commit -m "feat: complete production-grade library management system"
   ```
2. Create a new repository on [GitHub](https://github.com/new).
3. Push your code:
   ```bash
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git branch -M main
   git push -u origin main
   ```

---

### Step 2: Create Managed PostgreSQL on Render.com
1. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** → **PostgreSQL**.
2. Set a Name (e.g. `library-postgres-db`).
3. Select the Free tier and click **Create Database**.
4. Once provisioned, copy the **Internal Database URL** (or External Database URL).

---

### Step 3: Create Web Service on Render.com
1. Click **New +** → **Web Service**.
2. Connect your GitHub repository.
3. Configure the service:
   * **Name**: `library-management-system`
   * **Environment**: `Node`
   * **Region**: Select same region as your PostgreSQL database
   * **Branch**: `main`
   * **Build Command**: `npm install && npx prisma generate && npx prisma db push && npm run seed`
   * **Start Command**: `node server.js`
4. Add **Environment Variables**:
   * `NODE_ENV` = `production`
   * `DATABASE_URL` = *(Paste the Internal Database URL from Step 2)*
   * `SESSION_SECRET` = *(Enter a strong random 64-character string)*
5. Click **Create Web Service**.

Render will automatically install dependencies, generate the Prisma client, apply database schemas, seed initial library data, and launch your live application at `https://your-app-name.onrender.com`!

---

## 🛡️ Security Best Practices Implemented
* **No Plaintext Passwords**: Password hashing with `bcryptjs`.
* **SQL Injection Prevention**: Parameterized database queries and atomic transactions via Prisma.
* **HTTP Security Headers**: `helmet` integration.
* **Rate Limiting**: `express-rate-limit` protecting `/login` and `/register` against brute-force attacks.
* **Secure Cookies**: HTTP-Only session cookies with production `secure` flags.
* **Safe File Uploads**: Validated image MIME types (`jpg`, `png`, `webp`) and file size limits (3MB max).
* **Safe Error Handling**: Production 500 error pages hide database errors and stack traces.

---

## 📄 License
This project is open-source and available under the [ISC License](LICENSE).
