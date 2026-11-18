# 🌿 BlogSpace – Full-Stack Editorial Blogging Platform

> **Codomax Digital Solutions Internship – Milestone: Database Integration**  
> **Theme:** Earthy Luxe Editorial (Muted Sage, Warm Cream, Beige & Deep Burgundy)  
> **Frontend:** Pure Semantic HTML5, CSS3 Custom Properties, Vanilla JavaScript (ES6+)  
> **Backend:** Node.js & Express.js REST API with JWT Authentication, bcrypt Password Hashing  
> **Database:** MongoDB (Local & MongoDB Atlas) with Mongoose ODM & Automatic Data Seeding  

---

## 📖 Project Overview

**BlogSpace** is an editorial SaaS publication platform designed for mindful essayists, lifestyle writers, and creative thinkers. Built as part of the Codomax Full-Stack Internship, this production-ready application delivers complete database-backed persistence via **MongoDB and Mongoose**, pairing an Earthy Luxe editorial design system with an enterprise-grade REST API backend.

---

## 🎯 Internship Milestone: Database Integration Objectives

This milestone achieves all four database integration requirements:

1. **Database Connection:**
   - Modular database configuration in [`config/db.js`](file:///C:/Users/Admin/internship%20codomax/task1/config/db.js).
   - Flexible connection to either **MongoDB Atlas** cloud clusters or **Local MongoDB** (`mongodb://127.0.0.1:27017/blogspace`).
   - Secure connection URI management via [`.env`](file:///C:/Users/Admin/internship%20codomax/task1/.env).
   - Robust connection error handling with diagnostics and automated data seeding.

2. **User Data Storage:**
   - Dedicated User schema and model in [`models/User.js`](file:///C:/Users/Admin/internship%20codomax/task1/models/User.js).
   - Stores `name`, `username`, `email`, role, avatar, and bcrypt-hashed passwords.
   - Enforces unique email indexes to prevent duplicate registrations (`409 Conflict`).
   - Mongoose pre-save hook guarantees passwords are salt-hashed before persistence.
   - Plain-text passwords are never stored and strictly stripped from all API projections.
   - Preserves stateless JWT bearer token authentication.

3. **Permanent Blog Data Storage:**
   - Dedicated Blog schema and model in [`models/Blog.js`](file:///C:/Users/Admin/internship%20codomax/task1/models/Blog.js).
   - Stores `title`, `slug`, `category`, `excerpt`, `coverImage`, `content`, `authorId`, `author`, `date`, `readTime`, `status`, and `views`.
   - Binds each article to its registered author (`authorId`).
   - Complete CRUD operations: Create (`POST`), Read (`GET`), Update (`PUT`), and Delete (`DELETE`).
   - Enforces author-level ownership boundaries (`403 Forbidden` for unauthorized edits/deletions).

4. **Dynamic Blog Retrieval & Display:**
   - `GET /api/blogs` queries MongoDB directly with support for category filters, status filters, author filters, and search terms.
   - Dynamic rendering on the homepage with **Loading States**, **Empty States**, and **Error States** with retry buttons.
   - Real-time reflection of newly created stories upon publication.

5. **Dedicated Blog Details Page:**
   - Dedicated editorial story page in [`blog-details.html`](file:///C:/Users/Admin/internship%20codomax/task1/blog-details.html).
   - Seamless navigation from homepage blog cards using the unique MongoDB ID (`blog-details.html?id=<mongo_id>`).
   - Fetches and displays complete title, author bio, category, published date, read time, view count, cover image, and formatted prose paragraphs.
   - Graceful 404 / error state for missing, non-existent, or malformed MongoDB IDs with return navigation.

---

## 🛠️ Technology Stack & Architecture

### Backend & Database Architecture
- **Runtime:** Node.js (v18+)
- **Web Framework:** Express.js (v5.3.0)
- **Database & ODM:** MongoDB + Mongoose (v8+)
- **Security & Cryptography:** 
  - `bcryptjs` (v3.0.3) for 10-round salted password hashing
  - `jsonwebtoken` (v9.0.3) for HMAC-SHA256 bearer token authorization
  - `dotenv` (v18.0.10) for 12-factor environment management
- **CORS Support:** `cors` middleware for cross-origin browser requests
- **Database Seeding:** Automatically populates demo accounts and curated editorial essays if collections are empty.

### Frontend Architecture
- **Structure:** Semantic HTML5 (`index.html`, `blog-details.html`, `login.html`, `register.html`, `dashboard.html`, `create-blog.html`)
- **Styling:** CSS3 Design System with Earthy Luxe custom variables (`#641E32`, `#A3AA98`, `#F7F2E8`, `#D8C8B4`, `#35382F`, `#FFFCF6`)
- **Typography:** Playfair Display (Serif Headings) & DM Sans (Body Prose) via Google Fonts
- **Client Logic:** Vanilla JavaScript (ES6+ `fetch`, async/await, Lucide vector icons)

---

## 📁 Project Directory Structure

```
task1/
├── .env                    # Active environment variables (git-ignored)
├── .env.example            # Environment configuration template
├── .gitignore              # Ignores node_modules, .env, and logs
├── package.json            # Manifest with Express, Mongoose, bcryptjs, JWT
├── server.js               # Express application entry point & static server
├── test_suite.js           # 20-point automated QA & MongoDB verification suite
│
├── config/
│   └── db.js               # Mongoose connection manager, error handler & seeder
│
├── models/
│   ├── User.js             # Mongoose User schema (bcrypt pre-save, unique email)
│   └── Blog.js             # Mongoose Blog schema (user association, readTime, slug)
│
├── routes/
│   ├── authRoutes.js       # Register, login, and profile session endpoints
│   └── blogRoutes.js       # MongoDB CRUD, filtering, ownership & stats endpoints
│
├── middleware/
│   └── auth.js             # JWT verification & Bearer token middleware
│
├── data/
│   ├── users.json          # Initial seed template for demo author
│   └── blogs.json          # Initial seed template for curated essays
│
├── index.html              # Earthy Luxe editorial homepage & journal feed
├── blog-details.html       # Dedicated individual blog details page
├── login.html              # Split-screen editorial sign-in page
├── register.html           # Split-screen author membership registration
├── dashboard.html          # Author studio dashboard & story manager
├── create-blog.html        # Distraction-free Markdown writing studio
│
├── css/
│   └── style.css           # Earthy Luxe complete responsive design system
│
├── js/
│   └── script.js           # Full-stack API client, MongoDB integration & UI controllers
│
└── images/
    └── logo.svg            # Deep burgundy & warm cream vector brand emblem
```

---

## 📡 REST API Reference

| Method | Endpoint | Access | Description | Status Codes |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/health` | Public | System status, database connection, and uptime | `200` |
| **POST** | `/api/auth/register` | Public | Register new user in MongoDB with bcrypt & JWT | `201`, `400`, `409` |
| **POST** | `/api/auth/login` | Public | Authenticate credentials against MongoDB & issue JWT | `200`, `400`, `401` |
| **GET** | `/api/auth/me` | Protected | Verify active JWT session & return user profile | `200`, `401`, `404` |
| **GET** | `/api/blogs` | Public | Fetch all stories from MongoDB (`?category=`, `?status=`, `?search=`, `?authorId=`) | `200`, `500` |
| **GET** | `/api/blogs/stats` | Public | Live metrics calculated from MongoDB (total, published, drafts, views) | `200`, `500` |
| **GET** | `/api/blogs/:id` | Public | Fetch individual story by unique MongoDB ID or slug | `200`, `404`, `500` |
| **POST** | `/api/blogs` | Protected | Create new story permanently in MongoDB (binds `authorId`) | `201`, `400`, `401` |
| **PUT** | `/api/blogs/:id` | Protected | Update story in MongoDB (author ownership enforced) | `200`, `400`, `401`, `403`, `404` |
| **DELETE** | `/api/blogs/:id` | Protected | Permanently delete story from MongoDB (author ownership enforced) | `200`, `401`, `403`, `404` |

---

## ⚡ Installation & Setup Instructions

### 1. Clone the Repository & Navigate to Directory
```bash
cd task1
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to create your local `.env`:
```bash
# On Windows PowerShell:
Copy-Item .env.example .env

# On Linux / macOS:
cp .env.example .env
```

Open `.env` and set your preferred MongoDB connection string:

```env
PORT=5000
NODE_ENV=development

# Option A: Local MongoDB
MONGODB_URI=mongodb://127.0.0.1:27017/blogspace

# Option B: MongoDB Atlas (Cloud)
# MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/blogspace?retryWrites=true&w=majority

JWT_SECRET=blogspace_super_secret_jwt_key_2026_earthy_luxe
JWT_EXPIRES_IN=7d
```

### 4. Running MongoDB
- **Local MongoDB:** Start your local MongoDB service:
  ```bash
  # Windows:
  net start MongoDB
  # or run mongod in a separate terminal:
  mongod
  ```
- **MongoDB Atlas:** Simply paste your cluster connection string into `MONGODB_URI` in `.env`.

### 5. Start the Application
```bash
npm start
```
The server will start at `http://localhost:5000`.

### 6. Open in Browser
- Open `http://localhost:5000` to view the homepage.
- Click any article to view the dedicated blog details page: `http://localhost:5000/blog-details.html?id=<mongo_id>`.
- Sign in, create new essays, and manage your dashboard.

---

## 🧪 Automated Testing & Verification Suite

Run the built-in 20-point verification suite:
```bash
npm test
```

### Verification Suite Coverage:
1. `GET /api/health` validates database connection status (`connected`) and service uptime.
2. `POST /api/auth/register` creates user in MongoDB, returns JWT, and strictly omits password.
3. MongoDB document verification: password stored as salted bcrypt hash (`$2b$10$...`), username generated.
4. Duplicate email registration rejected with `409 Conflict`.
5. Invalid email format and short password rejected with `400 Bad Request`.
6. `POST /api/auth/login` validates credentials against MongoDB bcrypt hash and issues valid JWT.
7. Login with invalid password rejected with `401 Unauthorized`.
8. `POST /api/blogs` creates story permanently in MongoDB and binds `authorId` to JWT user.
9. Direct MongoDB query confirms persistent document storage.
10. `POST /api/blogs` without JWT is rejected with `401 Unauthorized`.
11. `GET /api/blogs` returns array of stories from MongoDB with total count.
12. Filtering by category (`?category=Lifestyle`) queries MongoDB collection accurately.
13. `GET /api/blogs/:id` retrieves individual story matching unique MongoDB ID with full author & content.
14. `GET /api/blogs/:id` returns graceful `404 Not Found` for non-existent MongoDB ObjectIds.
15. `GET /api/blogs/:id` returns graceful `404 Not Found` for malformed IDs without crashing.
16. `PUT /api/blogs/:id` by story author updates story in MongoDB.
17. `PUT /api/blogs/:id` by a different user returns `403 Forbidden` (ownership boundary).
18. `DELETE /api/blogs/:id` by story author permanently removes story from MongoDB.
19. Verification that deleted story is permanently removed (returns 404).
20. `GET /api/blogs/stats` returns accurate numeric counts from MongoDB for dashboard cards.

---

## 🔑 Default Evaluator Credentials

To test the application immediately:
- **Email:** `alex@blogspace.io`
- **Password:** `password123`
- *Or click the prominent **Auto Fill** button directly on `login.html`.*
- *Or register a brand new account on `register.html`.*

---

## 👨‍💻 Internship Milestone Summary
- **Module:** Milestone – Database Integration
- **Platform:** BlogSpace Full-Stack Editorial Platform
- **Key Deliverables:** Mongoose Models (`User`, `Blog`), Database Configuration (`config/db.js`), Environment Variables (`.env`, `.env.example`), Dedicated Blog Details Page (`blog-details.html`), Dynamic Feed with Loading/Empty/Error States, Full CRUD API, and 20-Point Verification Test Suite.
