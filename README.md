# 🌿 BlogSpace – Full-Stack Editorial Blogging Platform

> **Codomax Digital Solutions Internship – Module 02: Intermediate Backend Development**  
> **Theme:** Earthy Luxe Editorial (Muted Sage, Warm Cream, Beige & Deep Burgundy)  
> **Frontend:** Pure Semantic HTML5, CSS3 Custom Properties, Vanilla JavaScript (ES6+)  
> **Backend:** Node.js & Express.js REST API with JWT Authentication, bcrypt Password Hashing, & JSON Database Persistence  

---

## 📖 Project Overview

**BlogSpace** is an editorial SaaS publication platform designed for mindful essayists, lifestyle writers, and creative thinkers. Built as part of the Codomax Full-Stack Internship, this production-ready application demonstrates mastery across both advanced frontend architecture (Earthy Luxe editorial UI) and resilient backend engineering (secure Express.js REST APIs with cryptographic password hashing and JSON Web Token authorization).

---

## 🛠️ Technology Stack & Architecture

### Backend Architecture
- **Runtime:** Node.js (v18+)
- **Web Framework:** Express.js (v5.3.0)
- **Security & Authentication:** 
  - `bcryptjs` (v3.0.3) for 10-round salted password hashing
  - `jsonwebtoken` (v9.0.3) for stateless HMAC-SHA256 bearer token authentication
  - `dotenv` (v18.0.10) for 12-factor configuration management
- **CORS Support:** `cors` middleware for cross-origin browser communication
- **Persistence Layer:** Atomic JSON file store (`data/db.js`, `data/users.json`, `data/blogs.json`) with thread-safe reads/writes
- **Architecture:** Clean MVC-inspired separation (Routes, Middleware, Data, Public Static Assets)

### Frontend Architecture
- **Structure:** Semantic HTML5 (`index.html`, `login.html`, `register.html`, `dashboard.html`, `create-blog.html`)
- **Styling:** CSS3 Design System with Earthy Luxe custom variables (`#641E32`, `#A3AA98`, `#F7F2E8`, `#D8C8B4`, `#35382F`, `#FFFCF6`)
- **Typography:** Playfair Display (Serif Headings) & DM Sans (Body Prose) via Google Fonts
- **Client Logic:** Vanilla JavaScript (ES6+ `fetch`, async/await, resilient offline-tolerant cache, native vector icons)

---

## 🔒 Security Implementations

1. **Cryptographic Password Hashing:**
   - Registration securely passes passwords through `bcrypt.hash(password, 10)`. Plain-text passwords are never saved in the database or logs.
   - Login compares submitted passwords using timing-safe `bcrypt.compare(password, user.password)`.
2. **Stateless JWT Authentication:**
   - On successful login or registration, the backend issues a signed JWT token containing `{ id, email, name, role }` with a configurable expiration (`7d`).
   - The token is verified via the `authenticateToken` middleware (`middleware/auth.js`) on protected endpoints.
3. **Resource Ownership Authorization:**
   - Each blog is permanently bound to its author (`authorId: req.user.id`).
   - `PUT /api/blogs/:id` and `DELETE /api/blogs/:id` enforce ownership checks: only the original author (or Admin) can modify or delete a story. Unauthorized attempts are rejected with `403 Forbidden`.
4. **Input Sanitization & Validation:**
   - Duplicate email validation (returns `409 Conflict`).
   - Email format regex validation and password minimum length checks (returns `400 Bad Request`).
   - Title, category, and content completeness validation.
5. **No Password Leakage:**
   - The database projection explicitly strips the `password` field before sending responses to the client (`{ password: _, ...safeUser }`).
   - Insecure localStorage password storage has been eradicated.

---

## 📡 REST API Reference

| Method | Endpoint | Access | Description | Status Codes |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/health` | Public | System status and service uptime | `200` |
| **POST** | `/api/auth/register` | Public | Register new author with bcrypt hashing & JWT issue | `201`, `400`, `409` |
| **POST** | `/api/auth/login` | Public | Authenticate user credentials & issue JWT | `200`, `400`, `401` |
| **GET** | `/api/auth/me` | Protected | Verify active session & return user profile | `200`, `401`, `404` |
| **GET** | `/api/blogs` | Public | Fetch all stories (supports `?category=`, `?status=`, `?search=`, `?authorId=`) | `200`, `500` |
| **GET** | `/api/blogs/stats` | Public | Aggregated metrics (total, published, drafts, total views) | `200`, `500` |
| **GET** | `/api/blogs/:id` | Public | Fetch individual story by ID | `200`, `404` |
| **POST** | `/api/blogs` | Protected | Create new story (binds `authorId` to JWT user) | `201`, `400`, `401` |
| **PUT** | `/api/blogs/:id` | Protected | Update existing story (author ownership enforced) | `200`, `400`, `401`, `403`, `404` |
| **DELETE** | `/api/blogs/:id` | Protected | Delete existing story (author ownership enforced) | `200`, `401`, `403`, `404` |

---

## 📁 Project Directory Structure

```
task1/
├── .env.example            # Template for environment configuration
├── .gitignore              # Ignores node_modules, .env, and logs
├── package.json            # Project manifest, dependencies, and test scripts
├── server.js               # Express application entry point & static asset host
├── test_suite.js           # 15-point automated QA & security test runner
│
├── middleware/
│   └── auth.js             # JWT verification & Bearer token middleware
│
├── routes/
│   ├── authRoutes.js       # Register, login, and session REST endpoints
│   └── blogRoutes.js       # Blog CRUD, filtering, ownership, and stats endpoints
│
├── data/
│   ├── db.js               # Safe atomic JSON read/write manager
│   ├── users.json          # User accounts database (bcrypt hashed passwords)
│   └── blogs.json          # Curated blog stories database
│
├── index.html              # Earthy Luxe editorial homepage & public journal
├── login.html              # Split-screen editorial sign-in page
├── register.html           # Split-screen author membership registration
├── dashboard.html          # Author studio dashboard & story manager
├── create-blog.html        # Distraction-free Markdown writing studio
│
├── css/
│   └── style.css           # Earthy Luxe complete responsive design system
│
├── js/
│   └── script.js           # Full-stack API client, JWT management, & UI handlers
│
└── images/
    └── logo.svg            # Deep burgundy & warm cream vector brand emblem
```

---

## ⚡ Installation & Getting Started

### 1. Clone the Repository & Navigate to Folder
```bash
git clone <your-repo-url>
cd task1
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to create your local `.env` file:
```bash
cp .env.example .env
```
*(On Windows PowerShell: `Copy-Item .env.example .env`)*

Your `.env` contains:
```env
PORT=5000
NODE_ENV=development
JWT_SECRET=blogspace_super_secret_jwt_key_2026_earthy_luxe
JWT_EXPIRES_IN=7d
```

### 4. Start the Application
```bash
npm start
```
The server will boot on `http://localhost:5000`.

### 5. Open in Your Browser
- **Full-Stack Mode:** Open `http://localhost:5000` in any modern web browser.
- All HTML pages, CSS stylesheets, client JavaScript, and REST APIs are served synchronously.

---

## 🧪 Automated Testing & Verification

Run the built-in 15-point verification suite:
```bash
npm test
```

### Test Suite Coverage:
1. `GET /api/health` returns status 200 OK.
2. `POST /api/auth/register` validates and creates new user, returns JWT, omits password.
3. Database verification: password stored as salted bcrypt hash (`$2b$10$...`).
4. Duplicate email rejection returns `409 Conflict`.
5. Invalid email format and short password return `400 Bad Request`.
6. `POST /api/auth/login` validates bcrypt hash and issues JWT.
7. Login with invalid password returns `401 Unauthorized`.
8. `POST /api/blogs` with JWT creates story and binds `authorId`.
9. `POST /api/blogs` without JWT is rejected with `401 Unauthorized`.
10. `GET /api/blogs` returns array of stories with total count.
11. `GET /api/blogs/:id` retrieves single story by ID.
12. `PUT /api/blogs/:id` by story author updates story successfully.
13. `PUT /api/blogs/:id` by a different user returns `403 Forbidden` (ownership boundary).
14. `DELETE /api/blogs/:id` by story author permanently removes story from database.
15. `GET /api/blogs/stats` returns accurate numeric counts for dashboard cards.

---

## 🔑 Default Evaluator Credentials

To test the application immediately without registering:
- **Email:** `alex@blogspace.io`
- **Password:** `password123`
- *Or click the prominent **Auto Fill** button directly on `login.html`.*

---

## 📤 Git Submission Commands

To submit this project to your GitHub repository:

```bash
# 1. Initialize git if not already initialized
git init

# 2. Check status (verify .env and node_modules are ignored)
git status

# 3. Add all files to staging
git add .

# 4. Commit changes with a descriptive message
git commit -m "feat(backend): implement Node.js Express REST APIs with bcrypt and JWT auth"

# 5. Set main branch
git branch -M main

# 6. Add remote GitHub repository (replace with your repo URL)
git remote add origin https://github.com/<your-username>/<your-repo-name>.git

# 7. Push to GitHub
git push -u origin main
```

---

## 👨‍💻 Author & Acknowledgements

- **Intern:** Full-Stack Web Development Intern
- **Company:** Codomax Digital Solutions
- **Module:** Module 02 – Intermediate Backend Development
