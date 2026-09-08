<div align="center">

  <h1>📚 Central Library Management System</h1>

  <!-- Animated Live Status Typing Header -->
  <a href="https://library-management-system-kxep.onrender.com" target="_blank">
    <img src="https://readme-typing-svg.demolab.com?font=Poppins&weight=600&size=22&duration=2500&pause=1000&color=059669&center=true&vCenter=true&width=620&lines=Project+is+Live+Now+!;Full-Stack+Library+Management+System;Online+UPI+QR+Payments+and+Live+Timer;Role-Based+Admin,+Staff+and+Student+Portals" alt="Project is Live Now" />
  </a>

  <br><br>

  <!-- Big Glowing Live Demo Button -->
  <p align="center">
    <a href="https://library-management-system-kxep.onrender.com" target="_blank">
      <img src="https://img.shields.io/badge/🚀_LIVE_PREVIEW-CLICK_TO_OPEN_PROJECT-0B291E?style=for-the-badge&logo=render&logoColor=F59E0B" height="42" alt="Live Demo Button" />
    </a>
    <a href="https://library-management-system-kxep.onrender.com" target="_blank">
      <img src="https://img.shields.io/badge/⚡_STATUS-ONLINE_24%2F7-059669?style=for-the-badge&logo=statuspage&logoColor=white" height="42" alt="Online Status" />
    </a>
  </p>

  <!-- Tech Stack Badges -->
  <p align="center">
    <img src="https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js" />
    <img src="https://img.shields.io/badge/Express.js-4.x-000000?style=flat-square&logo=express&logoColor=white" alt="Express.js" />
    <img src="https://img.shields.io/badge/PostgreSQL-16+-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
    <img src="https://img.shields.io/badge/Prisma_ORM-6.x-2D3748?style=flat-square&logo=prisma&logoColor=white" alt="Prisma" />
    <img src="https://img.shields.io/badge/Bootstrap-5.3-7952B3?style=flat-square&logo=bootstrap&logoColor=white" alt="Bootstrap 5" />
    <img src="https://img.shields.io/badge/HTML5-Modern_Templates-E34F26?style=flat-square&logo=html5&logoColor=white" alt="HTML5" />
    <img src="https://img.shields.io/badge/CSS3-Luxury_Glassmorphism-1572B6?style=flat-square&logo=css3&logoColor=white" alt="CSS3" />
  </p>

</div>

---

## 🌐 Live Cloud Demo & Instant Access

> **🔗 Production URL:** [https://library-management-system-kxep.onrender.com](https://library-management-system-kxep.onrender.com)  
> *Hosted with automated CI/CD on Render with PostgreSQL Cloud Database.*

### 🔑 Demo Login Credentials (Ready to Test):

| Role | Email Address | Password | Access Portal |
| :--- | :--- | :--- | :--- |
| **🛡️ Administrator** | `admin@library.local` | `Admin@LmsMaster#2026` | [Admin Console](https://library-management-system-kxep.onrender.com/login?role=admin) |
| **💼 Staff / Employee** | `employee@library.local` | `Staff@LmsVault#2026` | [Staff Portal](https://library-management-system-kxep.onrender.com/login?role=employee) |
| **🎓 Student 1 (With Fines)** | `student1@college.edu` | `Student@LmsSecure#2026` | [Student Portal](https://library-management-system-kxep.onrender.com/login?role=student) |
| **🎓 Student 2 (Pending Fee)**| `student2@college.edu` | `Student@LmsSecure#2026` | [Student Portal](https://library-management-system-kxep.onrender.com/login?role=student) |

*💡 Tip: On the login page, you can also use the **1-Click Demo Fillers** (`🎓 Student`, `💼 Staff`, `🛡️ Admin`) to populate credentials instantly without typing!*

---

## 🌟 Key Application Features

### 🛡️ 1. Multi-Role Authentication & Access Control (RBAC)
* **Three Dedicated User Roles**:
  * `ADMIN` &rarr; Full system authority, policy engine, financial overview & staff permissions management.
  * `EMPLOYEE` &rarr; Circulation desk operations, book returns, direct issues & request verification.
  * `STUDENT` &rarr; Self-service catalog reservations, 1-click loan renewals, monthly pass & UPI payments.
* **Security & Session Layer**: `express-session` with HTTPS reverse proxy trust, HTTP-only secure cookies, and bcrypt password hashing (cost factor 10).
* **Granular Staff Permissions Matrix**: 11 distinct operational permissions that can be dynamically granted or revoked by the Admin.

---

### 💳 2. Online UPI Payment System & Real-Time QR Scanner
* **2-Minute Dynamic Countdown Timer**: Live animated countdown clock when scanning the payment QR code.
* **Strict 12-Digit UTR Constraint**: Client and server-side validation enforcing exact 12-digit bank transaction reference numbers.
* **Payment Screenshot Upload**: Multer multipart upload allowing students to upload transaction proof.
* **Admin Verification Workflow**:
  * Pending dues remain in `UNDER_VERIFICATION` status until verified.
  * Admin / Staff reviews the submitted UTR and screenshot proof to either **Approve** (settles dues & generates automated receipt `REC-UPI-XXXX`) or **Reject** with a reason.
* **Supported Payment Modules**:
  1. **₹500 Monthly Student Membership Pass** (`/memberships/student`)
  2. **Overdue Daily Return Penalties / Fines** (`/fines/student`)

---

### 📊 3. Interactive Analytics & Financial Ledger
* **Clickable KPI Counter Cards**:
  * Total Books, Active Students, Issued Books, Overdue Returns, Unpaid Fines.
* **Live Revenue & Outstanding Dues Breakdown**:
  * 🟢 **Revenue Received (`PAID`)** &bull; 🔴 **Total Outstanding Dues (`BAAKI`)** &bull; 🟡 **Pending UPI Verifications (`UNDER REVIEW`)**.
* **Interactive Chart.js Visualizations**:
  * 6-month monthly circulation activity trend (Issues vs Returns).
  * Inventory distribution by academic discipline doughnut chart.

---

### 📚 4. Book Inventory & Circulation Management
* **Strict 7-Book Verified Catalog**:
  * Atomic Habit (James Clear), The Psychology of Money (Morgan Housel), Think and Grow Rich (Napoleon Hill), Rich Dad Poor Dad (Robert Kiyosaki), Sapiens (Yuval Noah Harari), Ikigai, The Alchemist (Paulo Coelho).
* **Live Ajax Search & Multi-Filtering**: Instant title/author search suggestions and category filter.
* **Circulation Lifecycle**:
  * Reservation Request &rarr; Staff Review & Approve &rarr; Active Loan (`ISSUED`) &rarr; Loan Renewal (Policy limited) &rarr; Book Return & Fine Assessment.

---

## 🛠️ Complete Technology Stack

| Layer | Technology |
|---|---|
| **Backend Runtime** | **Node.js** (v18+) |
| **Web Framework** | **Express.js** 4.x |
| **Database** | **PostgreSQL** (Relational ACID DB) |
| **ORM / Query Engine** | **Prisma ORM** 6.x |
| **Frontend Templates** | **HTML5** (52 Pure HTML Structure Templates) |
| **Styling & Theme** | **Vanilla CSS3**, **Bootstrap 5.3**, Luxury Glassmorphism |
| **Client Scripting** | **Vanilla JavaScript** (Countdown Timer, AJAX Search, Password Toggle) |
| **Data Visualizations** | **Chart.js** 4.x |
| **Cloud Hosting** | **Render.com** (Automated CI/CD with PostgreSQL Cloud Database) |

---

## 📁 Project Directory Structure

```
LIBRARY MANAGEMENT SYSTEM/
├── prisma/
│   ├── schema.prisma          # PostgreSQL relational schema & models
│   └── seed.js                # Database seeder (7 verified books & demo accounts)
├── public/
│   ├── css/
│   │   ├── style.css          # Master stylesheet (Glassmorphism & animations)
│   │   ├── admin.css          # Fixed viewport layout & console theme
│   │   └── student.css        # Student portal styling
│   ├── js/
│   │   ├── main.js            # Global client utilities & live catalog search
│   │   ├── admin.js           # Dynamic Chart.js charts
│   │   └── student.js         # Countdown timer & UTR sanitizers
│   └── images/                # Book covers, institutional logo & UPI QR code
├── src/
│   ├── config/                # Database, session & policy settings
│   ├── controllers/           # HTTP Request handlers (Auth, Books, Fines, Issues, Memberships)
│   ├── middleware/            # Security guards, RBAC permissions, upload handlers
│   ├── routes/                # Express endpoint routers
│   ├── services/              # Business logic & Prisma query layer
│   └── views/                 # 52 Pure HTML UI Templates
│       ├── admin/             # Admin console views
│       ├── auth/              # Glassmorphic Login & Student Registration
│       ├── employee/          # Staff operations portal
│       ├── partials/          # Reusable Navbar, Sidebar, Head, Alerts
│       └── student/           # Student portal views (Catalog, Fines, Membership)
├── tests/                     # 5 Complete Automated Integration Test Suites (82 Tests)
├── render.yaml                # 1-Click Render Cloud Deployment Blueprint
├── server.js                  # HTTP Server Entry Point
└── package.json               # Dependencies & build scripts
```

---

## 💻 Local Installation & Setup

If you wish to run the application locally on your computer:

```bash
# 1. Clone the repository
git clone https://github.com/ujjwalkryadav/library-management-system.git
cd library-management-system

# 2. Install dependencies
npm install

# 3. Configure environment variables (.env)
cp .env.example .env

# 4. Push database schema & seed initial data
npx prisma db push
npm run seed

# 5. Start the local server
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser!

---

## 🧪 Automated Test Suite (100% Passed)

To run the complete automated test suite verifying all 82 integration test cases:

```bash
node tests/test-fine-upi.js && node tests/test-upi-payment.js && node tests/test-routes.js && node tests/test-employee-permissions.js && npm run test:workflow
```

---

<div align="center">
  <b>Built with ❤️ by Ujjwal Yadav</b> &bull; Production-Grade Library Management System
</div>
