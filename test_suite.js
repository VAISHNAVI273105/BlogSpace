/**
 * BlogSpace Backend 15-Point QA & Security Verification Suite
 * Tests all requirements: bcrypt, JWT auth, validation, authorization, CRUD, stats, health.
 */

const http = require('http');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = require('./server');
const db = require('./data/db');

const TEST_PORT = 5055;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api`;

let server;
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
  console.log('  🧪 STARTING BLOGSPACE BACKEND 15-POINT VERIFICATION');
  console.log('============================================================\n');

  // Start ephemeral test server
  await new Promise((resolve) => {
    server = app.listen(TEST_PORT, () => {
      console.log(`Test server running at http://127.0.0.1:${TEST_PORT}\n`);
      resolve();
    });
  });

  try {
    // -------------------------------------------------------------
    // Test 1: Health check endpoint
    // -------------------------------------------------------------
    console.log('\x1b[36m--- Section 1: System Health & Base Config ---\x1b[0m');
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200 && healthData.status === 'ok', '1. GET /api/health returns 200 and status ok');

    // -------------------------------------------------------------
    // Test 2: User Registration with valid credentials
    // -------------------------------------------------------------
    console.log('\n\x1b[36m--- Section 2: Authentication & Password Security ---\x1b[0m');
    const testEmail1 = `qa_author_${Date.now()}@blogspace.io`;
    const testPassword1 = 'SecurePass_2026!';

    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Elena Rostova',
        email: testEmail1,
        password: testPassword1
      })
    });
    const regData = await regRes.json();
    assert(
      regRes.status === 201 && regData.success === true && regData.token && !regData.user.password,
      '2. POST /api/auth/register registers user, returns JWT and omits password'
    );
    const author1Token = regData.token;
    const author1Id = regData.user.id;

    // -------------------------------------------------------------
    // Test 3: Password Hashing in Database
    // -------------------------------------------------------------
    const usersInDb = db.getUsers();
    const storedElena = usersInDb.find(u => u.id === author1Id);
    const isHashedWithBcrypt = storedElena && storedElena.password.startsWith('$2b$');
    const hashMatches = storedElena ? await bcrypt.compare(testPassword1, storedElena.password) : false;
    assert(
      isHashedWithBcrypt && hashMatches,
      '3. Password is salt-hashed with bcrypt (never stored in plain text)'
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
    // Test 6: User Login with correct credentials
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
      '6. POST /api/auth/login validates bcrypt password and returns valid JWT'
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
    // Test 8: Create Blog story (Protected with JWT)
    // -------------------------------------------------------------
    console.log('\n\x1b[36m--- Section 3: Blog Stories CRUD & Security ---\x1b[0m');
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
      createRes.status === 201 && createData.blog && createData.blog.authorId === author1Id,
      '8. POST /api/blogs creates story, binds authorId to JWT user, returns 201'
    );
    const createdBlogId = createData.blog ? createData.blog.id : null;

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
    // Test 10: Fetch all blogs
    // -------------------------------------------------------------
    const getBlogsRes = await fetch(`${BASE_URL}/blogs`);
    const getBlogsData = await getBlogsRes.json();
    assert(
      getBlogsRes.status === 200 && Array.isArray(getBlogsData.blogs) && getBlogsData.count > 0,
      '10. GET /api/blogs returns array of stories with total count'
    );

    // -------------------------------------------------------------
    // Test 11: Fetch single blog by ID
    // -------------------------------------------------------------
    const getSingleRes = await fetch(`${BASE_URL}/blogs/${createdBlogId}`);
    const getSingleData = await getSingleRes.json();
    assert(
      getSingleRes.status === 200 && getSingleData.blog && getSingleData.blog.id === createdBlogId,
      '11. GET /api/blogs/:id retrieves exact story matching ID'
    );

    // -------------------------------------------------------------
    // Test 12: Update blog by original author (Authorized)
    // -------------------------------------------------------------
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
      '12. PUT /api/blogs/:id allows author to update their story'
    );

    // -------------------------------------------------------------
    // Test 13: Reject update by a DIFFERENT author (Authorization Check)
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
    assert(foreignUpdateRes.status === 403, '13. PUT /api/blogs/:id rejects modification by non-author with 403 Forbidden');

    // -------------------------------------------------------------
    // Test 14: Delete blog by original author (Authorized)
    // -------------------------------------------------------------
    const deleteRes = await fetch(`${BASE_URL}/blogs/${createdBlogId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${author1Token}`
      }
    });
    assert(deleteRes.status === 200, '14. DELETE /api/blogs/:id allows author to delete their story');

    // Verify deletion in database
    const verifyDelRes = await fetch(`${BASE_URL}/blogs/${createdBlogId}`);
    assert(verifyDelRes.status === 404, '    -> Verify story is permanently removed (returns 404)');

    // -------------------------------------------------------------
    // Test 15: Dashboard Statistics endpoint
    // -------------------------------------------------------------
    console.log('\n\x1b[36m--- Section 4: Analytics & Metrics ---\x1b[0m');
    const statsRes = await fetch(`${BASE_URL}/blogs/stats`);
    const statsData = await statsRes.json();
    assert(
      statsRes.status === 200 &&
      typeof statsData.stats.total === 'number' &&
      typeof statsData.stats.published === 'number' &&
      typeof statsData.stats.drafts === 'number' &&
      typeof statsData.stats.views === 'number',
      '15. GET /api/blogs/stats returns real numeric counts for total, published, drafts, and views'
    );

  } catch (err) {
    console.error('\nFatal test runner error:', err);
    failedCount++;
  } finally {
    // Clean up test users from DB
    try {
      const allUsers = db.getUsers().filter(u => !u.email.startsWith('qa_'));
      db.saveUsers(allUsers);
    } catch (e) {}

    server.close(() => {
      console.log('\n============================================================');
      console.log(`  VERIFICATION SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
      console.log('============================================================\n');
      process.exit(failedCount === 0 ? 0 : 1);
    });
  }
}

runTests();
