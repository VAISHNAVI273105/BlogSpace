/**
 * BlogSpace Backend & MongoDB Integration QA & Security Verification Suite
 * Tests all requirements:
 * 1. Database Connection (MongoDB / Mongoose)
 * 2. User Data Storage & bcrypt Password Hashing (Never plain-text)
 * 3. Duplicate Email Prevention & Validation
 * 4. JWT Authentication & Protected Routes
 * 5. Permanent Blog Data Storage in MongoDB & User Association
 * 6. Retrieve All Blogs & Filter Queries
 * 7. Individual Blog Details by Unique MongoDB ID & 404 Handling
 * 8. Authorization Boundaries (403 Forbidden for Non-Authors)
 * 9. Update & Permanent Deletion in MongoDB
 * 10. Dashboard Analytics & Health Diagnostics
 */

const http = require('http');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('./server');
const { connectDB, disconnectDB } = require('./config/db');
const User = require('./models/User');
const Blog = require('./models/Blog');

const TEST_PORT = 5055;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api`;

let server;
let mongodServer = null;
let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    passedCount++;
    console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${testName}`);
  } else {
    failedCount++;
    console.error(`  \x1b[31m✖ [FAIL]\x1b[0m ${testName} ${details ? '(' + details + ')' : ''}`);
  }
}

async function runTests() {
  console.log('\n============================================================');
  console.log('  🧪 STARTING BLOGSPACE MONGODB INTEGRATION VERIFICATION');
  console.log('============================================================\n');

  // Step 1: Connect to MongoDB (use existing connection or launch MongoMemoryServer)
  let mongoUri = process.env.MONGODB_URI;
  try {
    const testConn = await connectDB(mongoUri);
    if (!testConn) {
      console.log('Starting in-memory MongoDB server for testing...');
      mongodServer = await MongoMemoryServer.create();
      mongoUri = mongodServer.getUri();
      await connectDB(mongoUri);
    }
  } catch (err) {
    console.log('Starting fallback in-memory MongoDB server for testing...');
    mongodServer = await MongoMemoryServer.create();
    mongoUri = mongodServer.getUri();
    await connectDB(mongoUri);
  }

  // Step 2: Start test HTTP server
  await new Promise((resolve) => {
    server = app.listen(TEST_PORT, () => {
      console.log(`Test server running at http://127.0.0.1:${TEST_PORT}\n`);
      resolve();
    });
  });

  try {
    // -------------------------------------------------------------
    // Test 1: Health check endpoint with database status
    // -------------------------------------------------------------
    console.log('\x1b[36m--- Section 1: System Health & Database Connectivity ---\x1b[0m');
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    assert(
      healthRes.status === 200 && healthData.status === 'ok' && healthData.database === 'connected',
      '1. GET /api/health returns 200, status ok, and database connected'
    );

    // -------------------------------------------------------------
    // Test 2: User Registration in MongoDB
    // -------------------------------------------------------------
    console.log('\n\x1b[36m--- Section 2: User Data Storage & Password Hashing ---\x1b[0m');
    const testEmail1 = `qa_author_${Date.now()}@blogspace.io`;
    const testPassword1 = 'SecurePass_2026!';
    const testName1 = 'Elena Rostova';

    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: testName1,
        email: testEmail1,
        password: testPassword1
      })
    });
    const regData = await regRes.json();
    assert(
      regRes.status === 201 && regData.success === true && regData.token && !regData.user.password,
      '2. POST /api/auth/register registers user in MongoDB, returns JWT and omits password'
    );
    const author1Token = regData.token;
    const author1Id = regData.user.id;

    // -------------------------------------------------------------
    // Test 3: Password Hashing in MongoDB Document (Never Plain-Text)
    // -------------------------------------------------------------
    const storedElena = await User.findById(author1Id);
    const isHashedWithBcrypt = storedElena && storedElena.password.startsWith('$2b$');
    const hashMatches = storedElena ? await bcrypt.compare(testPassword1, storedElena.password) : false;
    assert(
      storedElena && isHashedWithBcrypt && hashMatches && storedElena.username === 'elena_rostova',
      '3. Password is salt-hashed with bcrypt in MongoDB (never stored in plain text), username generated'
    );

    // -------------------------------------------------------------
    // Test 4: Duplicate Email Rejection
    // -------------------------------------------------------------
    const dupRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Elena Impostor',
        email: testEmail1,
        password: 'AnotherPassword123'
      })
    });
    const dupData = await dupRes.json();
    assert(dupRes.status === 409 && dupData.success === false, '4. Duplicate email registration rejected with 409 Conflict');

    // -------------------------------------------------------------
    // Test 5: Input Validation (Invalid email & short password)
    // -------------------------------------------------------------
    const valRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bad Email User',
        email: 'invalid-email-format',
        password: '123'
      })
    });
    assert(valRes.status === 400, '5. Invalid email format and short password rejected with 400 Bad Request');

    // -------------------------------------------------------------
    // Test 6: User Login with correct credentials against MongoDB
    // -------------------------------------------------------------
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail1,
        password: testPassword1
      })
    });
    const loginData = await loginRes.json();
    assert(
      loginRes.status === 200 && loginData.success === true && loginData.token && !loginData.user.password,
      '6. POST /api/auth/login validates bcrypt password against MongoDB and returns JWT'
    );

    // -------------------------------------------------------------
    // Test 7: User Login with incorrect password
    // -------------------------------------------------------------
    const badLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail1,
        password: 'WrongPassword_XYZ'
      })
    });
    assert(badLoginRes.status === 401, '7. Login with invalid password rejected with 401 Unauthorized');

    // -------------------------------------------------------------
    // Register Author 2 for authorization boundary tests
    // -------------------------------------------------------------
    const testEmail2 = `qa_other_${Date.now()}@blogspace.io`;
    const regRes2 = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Julian Vance',
        email: testEmail2,
        password: 'Pass_OtherUser_2026!'
      })
    });
    const regData2 = await regRes2.json();
    const author2Token = regData2.token;

    // -------------------------------------------------------------
    // Test 8: Create Blog story in MongoDB (Protected with JWT)
    // -------------------------------------------------------------
    console.log('\n\x1b[36m--- Section 3: Blog Storage & CRUD Operations in MongoDB ---\x1b[0m');
    const newBlogPayload = {
      title: 'Architectures of Serenity: The Aesthetics of Minimalist Living',
      category: 'Lifestyle',
      excerpt: 'Exploring how conscious reduction of clutter yields cognitive lucidity.',
      content: 'True minimalism is neither an aesthetic obsession nor an exercise in scarcity. It is the conscious elimination of noise to amplify what holds profound personal resonance.',
      status: 'published'
    };

    const createRes = await fetch(`${BASE_URL}/blogs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${author1Token}`
      },
      body: JSON.stringify(newBlogPayload)
    });
    const createData = await createRes.json();
    assert(
      createRes.status === 201 && createData.blog && createData.blog.authorId.toString() === author1Id,
      '8. POST /api/blogs creates story permanently in MongoDB, binds authorId to JWT user, returns 201'
    );
    const createdBlogId = createData.blog ? (createData.blog._id || createData.blog.id) : null;

    // Verify blog is in MongoDB directly
    const directBlogDoc = await Blog.findById(createdBlogId);
    assert(
      directBlogDoc && directBlogDoc.title === newBlogPayload.title,
      '   -> Verified blog document is permanently saved in MongoDB database'
    );

    // -------------------------------------------------------------
    // Test 9: Reject Blog Creation without JWT Token
    // -------------------------------------------------------------
    const noAuthCreateRes = await fetch(`${BASE_URL}/blogs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newBlogPayload)
    });
    assert(noAuthCreateRes.status === 401, '9. POST /api/blogs without token is rejected with 401 Unauthorized');

    // -------------------------------------------------------------
    // Test 10: Fetch all blogs from MongoDB
    // -------------------------------------------------------------
    const getBlogsRes = await fetch(`${BASE_URL}/blogs`);
    const getBlogsData = await getBlogsRes.json();
    assert(
      getBlogsRes.status === 200 && Array.isArray(getBlogsData.blogs) && getBlogsData.count > 0,
      '10. GET /api/blogs returns array of stories from MongoDB with count'
    );

    // Test query filter (category)
    const getFilteredRes = await fetch(`${BASE_URL}/blogs?category=Lifestyle`);
    const getFilteredData = await getFilteredRes.json();
    const allLifestyle = getFilteredData.blogs.every(b => b.category.toLowerCase() === 'lifestyle');
    assert(
      getFilteredRes.status === 200 && allLifestyle,
      '    -> Filter query ?category=Lifestyle correctly filters MongoDB collection'
    );

    // -------------------------------------------------------------
    // Test 11: Fetch single blog by unique MongoDB ID
    // -------------------------------------------------------------
    console.log('\n\x1b[36m--- Section 4: Individual Blog Details & Error Handling ---\x1b[0m');
    const getSingleRes = await fetch(`${BASE_URL}/blogs/${createdBlogId}`);
    const getSingleData = await getSingleRes.json();
    assert(
      getSingleRes.status === 200 &&
      getSingleData.blog &&
      (getSingleData.blog.id === createdBlogId || getSingleData.blog._id === createdBlogId) &&
      getSingleData.blog.title === newBlogPayload.title &&
      getSingleData.blog.content === newBlogPayload.content,
      '11. GET /api/blogs/:id retrieves exact story matching unique MongoDB ID with full content & author'
    );

    // -------------------------------------------------------------
    // Test 12: Handle invalid and non-existent IDs gracefully
    // -------------------------------------------------------------
    const nonExistentMongoId = new mongoose.Types.ObjectId().toString();
    const notFoundRes = await fetch(`${BASE_URL}/blogs/${nonExistentMongoId}`);
    assert(notFoundRes.status === 404, '12. GET /api/blogs/:id returns 404 for non-existent MongoDB ObjectId');

    const malformedIdRes = await fetch(`${BASE_URL}/blogs/invalid-id-xyz-not-found`);
    assert(malformedIdRes.status === 404, '    -> Returns 404 cleanly for invalid/unavailable IDs without crashing');

    // -------------------------------------------------------------
    // Test 13: Update blog by original author (Authorized)
    // -------------------------------------------------------------
    console.log('\n\x1b[36m--- Section 5: Authorization & Deletion ---\x1b[0m');
    const updateRes = await fetch(`${BASE_URL}/blogs/${createdBlogId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${author1Token}`
      },
      body: JSON.stringify({
        title: 'Architectures of Serenity: Updated Chapter Two'
      })
    });
    const updateData = await updateRes.json();
    assert(
      updateRes.status === 200 && updateData.blog.title === 'Architectures of Serenity: Updated Chapter Two',
      '13. PUT /api/blogs/:id allows author to update their story in MongoDB'
    );

    // -------------------------------------------------------------
    // Test 14: Reject update by a DIFFERENT author (Ownership Boundary)
    // -------------------------------------------------------------
    const foreignUpdateRes = await fetch(`${BASE_URL}/blogs/${createdBlogId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${author2Token}`
      },
      body: JSON.stringify({
        title: 'Hacked Title By Other User'
      })
    });
    assert(foreignUpdateRes.status === 403, '14. PUT /api/blogs/:id rejects modification by non-author with 403 Forbidden');

    // -------------------------------------------------------------
    // Test 15: Delete blog by original author (Authorized)
    // -------------------------------------------------------------
    const deleteRes = await fetch(`${BASE_URL}/blogs/${createdBlogId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${author1Token}`
      }
    });
    assert(deleteRes.status === 200, '15. DELETE /api/blogs/:id allows author to permanently remove story from MongoDB');

    // Verify deletion in database
    const verifyDelRes = await fetch(`${BASE_URL}/blogs/${createdBlogId}`);
    assert(verifyDelRes.status === 404, '    -> Verified story is permanently removed from MongoDB (returns 404)');

    // -------------------------------------------------------------
    // Test 16: Dashboard Statistics endpoint from MongoDB
    // -------------------------------------------------------------
    console.log('\n\x1b[36m--- Section 6: Analytics & Dashboard Metrics ---\x1b[0m');
    const statsRes = await fetch(`${BASE_URL}/blogs/stats`);
    const statsData = await statsRes.json();
    assert(
      statsRes.status === 200 &&
      typeof statsData.stats.total === 'number' &&
      typeof statsData.stats.published === 'number' &&
      typeof statsData.stats.drafts === 'number' &&
      typeof statsData.stats.views === 'number',
      '16. GET /api/blogs/stats returns real numeric counts from MongoDB for total, published, drafts, and views'
    );

  } catch (err) {
    console.error('\nFatal test runner error:', err);
    failedCount++;
  } finally {
    // Clean up
    try {
      await User.deleteMany({ email: /^qa_/ });
      await Blog.deleteMany({ title: /Architectures of Serenity/ });
    } catch (e) {}

    server.close(async () => {
      try {
        await disconnectDB();
        if (mongodServer) {
          await mongodServer.stop();
        }
      } catch (e) {}

      console.log('\n============================================================');
      console.log(`  VERIFICATION SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
      console.log('============================================================\n');
      process.exit(failedCount === 0 ? 0 : 1);
    });
  }
}

runTests();
