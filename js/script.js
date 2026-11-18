/**
 * ============================================================================
 * BLOGSPACE – Earthy Luxe Editorial Platform (Full-Stack Edition)
 * Core JavaScript Application File
 * Connected with Node.js & Express.js REST APIs + Resilient Offline Fallback
 * ============================================================================
 */

// --- 1. Backend REST API Configuration ---
const API_BASE = (window.location.origin && window.location.origin.includes(':5000'))
  ? `${window.location.origin}/api`
  : 'http://localhost:5000/api';

let isBackendAvailable = false;

// Check Backend Connection Status
async function checkBackendConnection() {
  const pills = document.querySelectorAll('.api-status-pill');
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      isBackendAvailable = true;
      pills.forEach(p => {
        p.className = 'api-status-pill connected';
        p.innerHTML = '<span class="status-dot"></span> <span class="status-text">Node.js API Online</span>';
        p.title = 'Connected to Express.js REST API on localhost:5000';
      });
      return true;
    }
  } catch (err) {
    isBackendAvailable = false;
  }

  pills.forEach(p => {
    p.className = 'api-status-pill offline';
    p.innerHTML = '<span class="status-dot"></span> <span class="status-text">Local Storage Mode</span>';
    p.title = 'Backend server offline. Start server with: npm start';
  });
  return false;
}

// --- 2. REST API Client Services ---
function getAuthToken() {
  try {
    return localStorage.getItem('blogspace_authToken') || '';
  } catch (e) {
    return '';
  }
}

function getAuthHeaders() {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

const ApiService = {
  // Authentication: Register (Strictly Backend – bcrypt & JWT)
  async register(name, email, password) {
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Registration failed');
      }
      return data;
    } catch (err) {
      if (err.name === 'TypeError' && err.message.toLowerCase().includes('fetch')) {
        throw new Error('Unable to reach the BlogSpace backend on http://localhost:5000. Please start the Express server using "npm start".');
      }
      throw err;
    }
  },

  // Authentication: Login (Strictly Backend – bcrypt & JWT)
  async login(email, password) {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }
      return data;
    } catch (err) {
      if (err.name === 'TypeError' && err.message.toLowerCase().includes('fetch')) {
        throw new Error('Unable to reach the BlogSpace backend on http://localhost:5000. Please start the Express server using "npm start".');
      }
      throw err;
    }
  },

  // Authentication: Verify Session
  async verifySession() {
    const token = getAuthToken();
    if (!token) return null;
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        return data.user;
      }
    } catch (e) {
      console.warn('Session verification error:', e);
    }
    return null;
  },

  // Blogs: Fetch All (with filters & search)
  async getBlogs(params = {}) {
    try {
      const query = new URLSearchParams();
      if (params.category && params.category !== 'all') query.append('category', params.category);
      if (params.status && params.status !== 'all') query.append('status', params.status);
      if (params.search) query.append('search', params.search);
      if (params.authorId) query.append('authorId', params.authorId);

      const res = await fetch(`${API_BASE}/blogs?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.blogs) {
          saveStoredBlogs(data.blogs); // Sync client cache
          return data.blogs;
        }
      }
    } catch (e) {
      console.warn('API getBlogs error, using cache:', e);
    }
    // Cached fallback
    let blogs = getStoredBlogs();
    if (params.status && params.status !== 'all') {
      blogs = blogs.filter(b => b.status === params.status);
    }
    if (params.category && params.category !== 'all') {
      blogs = blogs.filter(b => b.category.toLowerCase() === params.category.toLowerCase());
    }
    if (params.authorId) {
      blogs = blogs.filter(b => b.authorId === params.authorId);
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      blogs = blogs.filter(b => 
        b.title.toLowerCase().includes(q) || 
        b.category.toLowerCase().includes(q) ||
        (b.excerpt && b.excerpt.toLowerCase().includes(q))
      );
    }
    return blogs;
  },

  // Blogs: Fetch Single Story by ID
  async getBlog(id) {
    try {
      const res = await fetch(`${API_BASE}/blogs/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.blog) return data.blog;
      }
    } catch (e) {
      console.warn('API getBlog error:', e);
    }
    const blogs = getStoredBlogs();
    return blogs.find(b => b.id === id) || null;
  },

  // Blogs: Fetch Stats
  async getStats(authorId) {
    try {
      const query = authorId ? `?authorId=${encodeURIComponent(authorId)}` : '';
      const res = await fetch(`${API_BASE}/blogs/stats${query}`);
      if (res.ok) {
        const data = await res.json();
        if (data.stats) return data.stats;
      }
    } catch (e) {
      console.warn('API getStats error, calculating locally:', e);
    }
    const blogs = getStoredBlogs();
    const target = authorId ? blogs.filter(b => b.authorId === authorId) : blogs;
    return {
      total: target.length,
      published: target.filter(b => b.status === 'published').length,
      drafts: target.filter(b => b.status === 'draft').length,
      views: target.reduce((acc, b) => acc + (b.views || 0), 0)
    };
  },

  // Blogs: Create Story (POST /api/blogs with JWT Token)
  async createBlog(blogData) {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication required. Please sign in to compose or draft stories.');
    }
    try {
      const res = await fetch(`${API_BASE}/blogs`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(blogData)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create blog');
      }
      const blogs = getStoredBlogs();
      blogs.unshift(data.blog);
      saveStoredBlogs(blogs);
      return data;
    } catch (err) {
      if (err.name === 'TypeError' && err.message.toLowerCase().includes('fetch')) {
        throw new Error('Unable to reach the BlogSpace backend on http://localhost:5000. Please start the Express server.');
      }
      throw err;
    }
  },

  // Blogs: Update Story (PUT /api/blogs/:id with JWT Token & Ownership Check)
  async updateBlog(id, blogData) {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication required. Please sign in to modify stories.');
    }
    try {
      const res = await fetch(`${API_BASE}/blogs/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(blogData)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update blog');
      }
      const blogs = getStoredBlogs();
      const index = blogs.findIndex(b => b.id === id);
      if (index !== -1) {
        blogs[index] = data.blog;
        saveStoredBlogs(blogs);
      }
      return data;
    } catch (err) {
      if (err.name === 'TypeError' && err.message.toLowerCase().includes('fetch')) {
        throw new Error('Unable to reach the BlogSpace backend on http://localhost:5000. Please start the Express server.');
      }
      throw err;
    }
  },

  // Blogs: Delete Story (DELETE /api/blogs/:id with JWT Token & Ownership Check)
  async deleteBlog(id) {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication required. Please sign in to delete stories.');
    }
    try {
      const res = await fetch(`${API_BASE}/blogs/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete blog');
      }
      let blogs = getStoredBlogs();
      blogs = blogs.filter(b => b.id !== id);
      saveStoredBlogs(blogs);
      return data;
    } catch (err) {
      if (err.name === 'TypeError' && err.message.toLowerCase().includes('fetch')) {
        throw new Error('Unable to reach the BlogSpace backend on http://localhost:5000. Please start the Express server.');
      }
      throw err;
    }
  }
};

// --- 3. Initial Seed Data ---
const DEFAULT_USERS = [
  {
    id: "user_demo_1",
    name: "Alex Morgan",
    email: "alex@blogspace.io",
    role: "Editor-in-Chief & Essayist",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
  }
];

const DEFAULT_BLOGS = [
  {
    id: "blog_1",
    title: "The Art of Intentional Living: Cultivating Stillness in Everyday Rituals",
    slug: "art-of-intentional-living",
    category: "Lifestyle",
    coverImage: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80",
    excerpt: "Why the quietest morning moments—a poured cup of tea, open linen pages, and soft natural sunlight—shape our creative resilience.",
    content: "We live in an era that ceaselessly demands acceleration. We are nudged to wake up with urgency, consume opinions before our feet touch the floor, and measure the value of a day strictly by its output.\n\nYet true inspiration has always demanded an opposite posture: deliberate stillness.\n\nWhen we create morning rituals grounded in tactile presence—the warmth of a handcrafted ceramic mug, the slow drift of sunlight across linen curtains, the unhurried texture of physical paper—we give our minds permission to synthesize rather than react.\n\nSlow living is not an abandonment of ambition. It is the conscious decision to anchor your days in presence, so that whatever you choose to write, create, or speak carries genuine depth.",
    author: {
      name: "Alex Morgan",
      role: "Editor-in-Chief",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
    },
    date: "Nov 14, 2026",
    readTime: "4 min read",
    status: "published",
    views: 1820
  },
  {
    id: "blog_2",
    title: "Gentle Formulations: Why Minimalist Skincare is the Future of Well-Being",
    slug: "gentle-formulations-minimalist-skincare",
    category: "Beauty",
    coverImage: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80",
    excerpt: "Returning to botanicals, cold-pressed seed oils, and simplified routines that honor the skin's natural lipid barrier.",
    content: "For years, the beauty industry convinced us that ten-step regimens and harsh synthetic exfoliants were prerequisites for healthy skin. In reality, modern dermatology and ancient herbalism agree on a simpler truth: restraint is restorative.\n\nBy turning to cold-pressed botanical oils like camellia and jojoba, raw squalane, and soothing floral waters, we allow the skin barrier to recalibrate.\n\nA mindful routine isn't just about topical nourishment—it is five minutes at dusk where you look in the mirror with gratitude rather than correction.",
    author: {
      name: "Camille Laurent",
      role: "Wellness Editor",
      avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&q=80"
    },
    date: "Nov 12, 2026",
    readTime: "5 min read",
    status: "published",
    views: 1240
  },
  {
    id: "blog_3",
    title: "The Enduring Elegance of Natural Linen: Timeless Wardrobe Philosophies",
    slug: "enduring-elegance-natural-linen",
    category: "Fashion",
    coverImage: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80",
    excerpt: "Embracing natural fibers, imperfect folds, and architectural silhouettes that outlast seasonal fashion cycles.",
    content: "There is an understated luxury in natural flax linen that fast fashion can never replicate. It breathes with the body, softens with every wash, and wears its subtle wrinkles as a badge of lived experience.\n\nBuilding an enduring capsule wardrobe requires shedding the illusion that newness equals style.\n\nWhen you invest in honest materials—undyed wools, organic silks, and heavy European linen—clothing ceases to be disposable and becomes a dependable second skin that ages alongside your personal journey.",
    author: {
      name: "Camille Laurent",
      role: "Creative Director",
      avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&q=80"
    },
    date: "Nov 10, 2026",
    readTime: "3 min read",
    status: "published",
    views: 2310
  },
  {
    id: "blog_4",
    title: "Morning Bread: The Quiet Meditation of Sourdough & Slow Fermentation",
    slug: "morning-bread-sourdough-meditation",
    category: "Food",
    coverImage: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80",
    excerpt: "Flour, spring water, sea salt, and patience. What leaven and sourdough baking taught me about trust and time.",
    content: "Baking a true crusty sourdough cannot be rushed by technological efficiency or clever hacks. It listens solely to temperature, wild micro-flora, and gentle dough folds performed across hours.\n\nIn our kitchen, sourdough baking has become an anchor. As you flour the wooden peel and score the loaf with a razor blade, you are practicing an art older than written civilization.\n\nWhen the warm, crackling loaf emerges from the cast-iron Dutch oven, filling the home with toasted caramel aromas, you realize that patience is not passive waiting—it is active reverence.",
    author: {
      name: "Matteo Rossi",
      role: "Culinary Writer",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80"
    },
    date: "Nov 08, 2026",
    readTime: "6 min read",
    status: "published",
    views: 1950
  },
  {
    id: "blog_5",
    title: "Hidden Terracotta Alleys: Solitary Journeys Along the Ligurian Coast",
    slug: "terracotta-alleys-ligurian-coast",
    category: "Travel",
    coverImage: "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=800&q=80",
    excerpt: "Stepping off the crowded train platforms into sun-warmed stone stairways, salt breezes, and forgotten coastal sanctuaries.",
    content: "Most travelers speed through coastal villages with checklists and selfie sticks. But if you take the narrow, unmarked stone staircase that winds behind the chapel, the tourist clamor evaporates into silence.\n\nAbove the cliffs, olive trees whisper against dry stone terraces built by hand three centuries ago. The sea below is an unblemished deep sapphire, framed by terracotta roofs baked by centuries of Mediterranean sun.\n\nTravel, at its most transformative, is not about cataloging landmarks. It is about allowing an unfamiliar horizon to quiet your internal chatter.",
    author: {
      name: "Alex Morgan",
      role: "Editor-in-Chief",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
    },
    date: "Nov 05, 2026",
    readTime: "4 min read",
    status: "published",
    views: 1420
  },
  {
    id: "blog_6",
    title: "Finding Form in Raw Earth: Lessons from an Afternoon with Clay",
    slug: "finding-form-raw-earth-ceramics",
    category: "Creativity",
    coverImage: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=800&q=80",
    excerpt: "Why centering clay on a spinning wheel is the most humbling metaphor for creative perseverance and surrender.",
    content: "If you try to force raw stoneware clay into a vessel with tense fingers, it will wobble, thin out, and collapse into a wet clump on the wheel head.\n\nThe wheel demands that you breathe, brace your elbows against your ribs, and establish stillness before you ask the clay to rise. You must negotiate with the material, respecting its moisture, grain, and physical thresholds.\n\nEvery creative pursuit shares this principle. You cannot bully an essay or painting into being; you create the conditions for its inherent beauty to emerge.",
    author: {
      name: "Sofia Berg",
      role: "Ceramicist & Naturalist",
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80"
    },
    date: "Nov 03, 2026",
    readTime: "5 min read",
    status: "published",
    views: 1680
  },
  {
    id: "blog_7",
    title: "A Return to Paper: Journaling Without the Digital Gaze",
    slug: "return-to-paper-journaling",
    category: "Lifestyle",
    coverImage: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80",
    excerpt: "Why handwriting in an unindexed notebook liberates thoughts from the subconscious drive for online performance.",
    content: "When you write on a screen connected to the internet, a phantom audience sits over your shoulder. Even in private draft documents, the clean Helvetica typography simulates a published thought.\n\nIn contrast, an analog notebook welcomes ink blots, jagged handwriting, and messy half-sentences. In that unfiltered space, genuine self-reckoning happens.",
    author: {
      name: "Alex Morgan",
      role: "Editor-in-Chief",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
    },
    date: "Nov 01, 2026",
    readTime: "4 min read",
    status: "draft",
    views: 210
  },
  {
    id: "blog_8",
    title: "The Palette of Nature: Foraging Pigments from Autumn Foliage",
    slug: "palette-of-nature-foraging-pigments",
    category: "Creativity",
    coverImage: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80",
    excerpt: "Extracting ochres, sage greens, and warm berry stains for botanical watercolor studies.",
    content: "Notes on gathering wild walnuts, fallen oak galls, and madder roots to craft natural ink and watercolor washes for studio exploration.",
    author: {
      name: "Sofia Berg",
      role: "Ceramicist & Naturalist",
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80"
    },
    date: "Oct 29, 2026",
    readTime: "6 min read",
    status: "draft",
    views: 95
  }
];

// Local Storage Keys
const STORAGE_KEYS = {
  BLOGS: "blogspace_blogs_v2",
  CURRENT_USER: "blogspace_currentUser_v2",
  AUTH_TOKEN: "blogspace_authToken"
};

function initStorage() {
  // Purge any legacy plain-text password stores from client localStorage
  try {
    localStorage.removeItem("blogspace_users_v2");
    localStorage.removeItem("blogspace_users");
  } catch (e) {}

  if (!localStorage.getItem(STORAGE_KEYS.BLOGS)) {
    localStorage.setItem(STORAGE_KEYS.BLOGS, JSON.stringify(DEFAULT_BLOGS));
  }
}

function getStoredBlogs() {
  initStorage();
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEYS.BLOGS));
    return Array.isArray(data) && data.length > 0 ? data : DEFAULT_BLOGS;
  } catch (e) {
    return DEFAULT_BLOGS;
  }
}

function saveStoredBlogs(blogs) {
  localStorage.setItem(STORAGE_KEYS.BLOGS, JSON.stringify(blogs));
}

function getCurrentUser() {
  try {
    const userStr = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    return null;
  }
}

function setCurrentUser(user, token) {
  if (user) {
    const { password, ...safeUser } = user;
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(safeUser));
  }
  if (token) {
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  }
}

function logoutUser() {
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  showToast("Logged Out", "You have been logged out from your creative studio.", "info");
  setTimeout(() => {
    window.location.href = "login.html";
  }, 700);
}

// --- 4. Native Vector Icon System ---
const SVG_ICONS = {
  "feather": '<path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/>',
  "edit-3": '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  "compass": '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  "book-open": '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  "sparkles": '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>',
  "menu": '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
  "x": '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  "check": '<polyline points="20 6 9 17 4 12"/>',
  "check-circle": '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  "check-circle-2": '<path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/>',
  "alert-circle": '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  "info": '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  "eye": '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  "eye-off": '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>',
  "edit-2": '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  "trash-2": '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  "plus": '<line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/>',
  "search": '<circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/>',
  "arrow-right": '<line x1="5" x2="19" y1="12" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  "arrow-left": '<line x1="19" x2="5" y1="12" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  "save": '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
  "send": '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  "lock": '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  "mail": '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  "user": '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  "user-plus": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>',
  "shield-check": '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/>',
  "clock": '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  "layout-dashboard": '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  "file-text": '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/>',
  "log-in": '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/>',
  "log-out": '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  "home": '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  "bar-chart-2": '<line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/>',
  "award": '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
  "trending-up": '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  "rocket": '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  "bold": '<path d="M6 12h9a4 4 0 0 1 0 8H6v-8zm0 0h8a3.5 3.5 0 0 0 0-7H6v7z"/>',
  "italic": '<line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/>',
  "heading-2": '<path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/>',
  "heading-3": '<path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2"/><path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2"/>',
  "quote": '<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/>',
  "list": '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>',
  "code": '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  "image": '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  "alert-triangle": '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>',
  "twitter": '<path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/>',
  "github": '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>',
  "linkedin": '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/>',
  "layers": '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  "sun": '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
  "coffee": '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>',
  "heart": '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  "palette": '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
  "pen-tool": '<path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/>',
  "globe": '<circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'
};

function initLucideIcons() {
  if (typeof lucide !== "undefined" && lucide.createIcons) {
    try {
      lucide.createIcons();
      return;
    } catch (e) {
      console.warn("Lucide CDN fallback:", e);
    }
  }

  const elements = document.querySelectorAll("[data-lucide]");
  elements.forEach(el => {
    const iconName = el.getAttribute("data-lucide");
    if (SVG_ICONS[iconName]) {
      const style = el.getAttribute("style") || "";
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      svg.setAttribute("width", "18");
      svg.setAttribute("height", "18");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "2");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");
      svg.setAttribute("class", `lucide lucide-${iconName}`);
      if (style) svg.setAttribute("style", style);
      svg.innerHTML = SVG_ICONS[iconName];

      el.parentNode.replaceChild(svg, el);
    }
  });
}

// --- 5. UI Helpers: Toasts, Modals, State ---
function showToast(title, message, type = "success") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const iconName = type === "success" ? "check-circle" : type === "error" ? "alert-circle" : "info";
  
  toast.innerHTML = `
    <div class="toast-icon">
      <i data-lucide="${iconName}"></i>
    </div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;

  container.appendChild(toast);
  initLucideIcons();

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    setTimeout(() => toast.remove(), 280);
  }, 3500);
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
    initLucideIcons();
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("open");
    document.body.style.overflow = "";
  }
}

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal-overlay")) {
    e.target.classList.remove("open");
    document.body.style.overflow = "";
  }
});

function setupMobileNav() {
  const toggleBtn = document.querySelector(".mobile-nav-toggle");
  const mobileMenu = document.querySelector(".mobile-nav-menu");
  if (toggleBtn && mobileMenu) {
    toggleBtn.addEventListener("click", () => {
      mobileMenu.classList.toggle("open");
    });
  }
}

function getFormattedDateNow() {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const d = new Date();
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}, ${d.getFullYear()}`;
}

function calculateReadTime(text) {
  const words = text ? text.trim().split(/\s+/).length : 0;
  const minutes = Math.max(1, Math.ceil(words / 170));
  return `${minutes} min read`;
}

function updateNavbarState() {
  const currentUser = getCurrentUser();
  const navActions = document.querySelector(".nav-actions");
  const mobileActions = document.querySelector(".mobile-actions");

  if (!navActions) return;

  const statusPillHTML = `<span class="api-status-pill ${isBackendAvailable ? 'connected' : 'offline'}" id="apiStatusPill" title="${isBackendAvailable ? 'Connected to Express REST API' : 'Run: npm start'}"><span class="status-dot"></span> <span class="status-text">${isBackendAvailable ? 'API Online' : 'Local Mode'}</span></span>`;

  if (currentUser) {
    navActions.innerHTML = `
      ${statusPillHTML}
      <a href="create-blog.html" class="btn btn-outline btn-sm">
        <i data-lucide="edit-3"></i> Write
      </a>
      <a href="dashboard.html" class="nav-user-chip" title="Go to Creative Studio">
        <img src="${currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}" alt="${currentUser.name}" class="nav-user-avatar">
        <span>${currentUser.name.split(" ")[0]}</span>
      </a>
      <button class="btn btn-ghost btn-sm" onclick="logoutUser()" title="Logout">
        <i data-lucide="log-out"></i>
      </button>
    `;
    if (mobileActions) {
      mobileActions.innerHTML = `
        <div style="margin-bottom: 0.5rem;">${statusPillHTML}</div>
        <a href="dashboard.html" class="btn btn-primary btn-block">Author Studio</a>
        <a href="create-blog.html" class="btn btn-outline btn-block">Write Story</a>
        <button onclick="logoutUser()" class="btn btn-ghost btn-block">Logout (${currentUser.name})</button>
      `;
    }
  } else {
    navActions.innerHTML = `
      ${statusPillHTML}
      <a href="login.html" class="nav-link">Sign In</a>
      <a href="register.html" class="btn btn-primary btn-sm">Get Started</a>
    `;
    if (mobileActions) {
      mobileActions.innerHTML = `
        <div style="margin-bottom: 0.5rem;">${statusPillHTML}</div>
        <a href="login.html" class="btn btn-outline btn-block">Sign In</a>
        <a href="register.html" class="btn btn-primary btn-block">Get Started</a>
      `;
    }
  }
  initLucideIcons();
}

// --- 6. Page 1: Home Page Controller (Connected with Backend) ---
async function initHomePage() {
  setupMobileNav();
  await checkBackendConnection();
  updateNavbarState();

  const startWritingBtn = document.getElementById("heroStartWritingBtn");
  if (startWritingBtn) {
    startWritingBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const user = getCurrentUser();
      window.location.href = user ? "create-blog.html" : "register.html";
    });
  }

  // Initial load of blogs from Backend API / Local fallback
  await renderHomeBlogs();

  // Category filter tabs
  const categoryChips = document.querySelectorAll(".category-chip");
  categoryChips.forEach(chip => {
    chip.addEventListener("click", async () => {
      categoryChips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      const selectedCat = chip.getAttribute("data-category");
      await renderHomeBlogs(selectedCat);
    });
  });

  const newsletterForm = document.getElementById("newsletterForm");
  if (newsletterForm) {
    newsletterForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = newsletterForm.querySelector("input[type='email']");
      if (input && input.value) {
        showToast("Welcome to the Circle", "You are now subscribed to the BlogSpace Sunday journal.", "success");
        input.value = "";
      }
    });
  }
}

async function renderHomeBlogs(category = "all") {
  const grid = document.getElementById("featuredBlogGrid");
  if (!grid) return;

  grid.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--secondary-text);">
      <p style="font-style: italic; font-family: var(--font-serif);">Loading curated essays...</p>
    </div>
  `;

  // Fetch from REST API (or fallback)
  const blogs = await ApiService.getBlogs({ category, status: 'published' });

  if (!blogs || blogs.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon"><i data-lucide="book-open"></i></div>
        <h3>No Stories Found</h3>
        <p>No published stories found in this category yet. Be the first to share an inspiring perspective.</p>
      </div>
    `;
    initLucideIcons();
    return;
  }

  grid.innerHTML = blogs.map(blog => {
    const badgeClass = `badge-${blog.category.toLowerCase()}`;
    return `
      <article class="blog-card">
        <div class="blog-card-thumbnail-wrap">
          <img src="${blog.coverImage}" alt="${blog.title}" class="blog-card-thumbnail" loading="lazy">
          <span class="badge ${badgeClass} blog-card-category-badge">${blog.category}</span>
        </div>
        <div class="blog-card-body">
          <div class="blog-card-meta-top">
            <span>${blog.date}</span>
            <span class="dot"></span>
            <span>${blog.readTime || '4 min read'}</span>
          </div>
          <h3 class="blog-card-title">${blog.title}</h3>
          <p class="blog-card-excerpt">${blog.excerpt}</p>
          <div class="blog-card-footer">
            <div class="author-info">
              <img src="${blog.author.avatar}" alt="${blog.author.name}" class="author-avatar">
              <div>
                <div class="author-name">${blog.author.name}</div>
                <div class="author-role">${blog.author.role || 'Contributor'}</div>
              </div>
            </div>
            <button class="read-more-btn" onclick="openStoryPreviewModal('${blog.id}')">
              Read Story <i data-lucide="arrow-right"></i>
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  initLucideIcons();
}

function openStoryPreviewModal(blogId) {
  const blogs = getStoredBlogs();
  const blog = blogs.find(b => b.id === blogId);
  if (!blog) return;

  const modal = document.getElementById("storyPreviewModal");
  if (!modal) return;

  const contentArea = modal.querySelector(".modal-body");
  const badgeClass = `badge-${blog.category.toLowerCase()}`;

  const formattedContent = blog.content
    .split("\n\n")
    .map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");

  contentArea.innerHTML = `
    <img src="${blog.coverImage}" alt="${blog.title}" class="preview-cover-img">
    <div class="preview-meta-row">
      <span class="badge ${badgeClass}">${blog.category}</span>
      <span style="font-size: 0.85rem; color: var(--secondary-text);">${blog.date} &bull; ${blog.readTime}</span>
    </div>
    <h1 class="preview-title">${blog.title}</h1>
    <div class="author-info" style="margin-bottom: 2rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--border-color);">
      <img src="${blog.author.avatar}" alt="${blog.author.name}" class="author-avatar" style="width: 44px; height: 44px;">
      <div>
        <div class="author-name" style="font-size: 1rem;">${blog.author.name}</div>
        <div class="author-role">${blog.author.role || 'Essayist'}</div>
      </div>
    </div>
    <div class="preview-content">
      ${formattedContent}
    </div>
  `;

  openModal("storyPreviewModal");
}

// --- 7. Page 2: Login Page Controller (Connected with Backend API) ---
async function initLoginPage() {
  await checkBackendConnection();
  const loginForm = document.getElementById("loginForm");
  const emailInput = document.getElementById("loginEmail");
  const passwordInput = document.getElementById("loginPassword");
  const passwordToggle = document.getElementById("togglePasswordBtn");
  const demoFillBtn = document.getElementById("demoFillBtn");
  const submitBtn = document.getElementById("loginSubmitBtn");

  if (passwordToggle && passwordInput) {
    passwordToggle.addEventListener("click", () => {
      const isPassword = passwordInput.type === "password";
      passwordInput.type = isPassword ? "text" : "password";
      passwordToggle.innerHTML = isPassword ? '<i data-lucide="eye-off"></i>' : '<i data-lucide="eye"></i>';
      initLucideIcons();
    });
  }

  if (demoFillBtn) {
    demoFillBtn.addEventListener("click", () => {
      emailInput.value = "alex@blogspace.io";
      passwordInput.value = "password123";
      showToast("Demo Credentials Loaded", "Ready to sign in to your editorial workspace.", "info");
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearFormErrors();

      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();
      let isValid = true;

      if (!email) {
        showInputError("loginEmail", "Email address is required.");
        isValid = false;
      } else if (!isValidEmail(email)) {
        showInputError("loginEmail", "Please provide a valid email address.");
        isValid = false;
      }

      if (!password) {
        showInputError("loginPassword", "Password cannot be empty.");
        isValid = false;
      }

      if (!isValid) return;

      const originalBtnText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<span style="display: inline-flex; align-items: center; gap: 0.5rem;"><i data-lucide="sun"></i> Signing In...</span>';
      submitBtn.disabled = true;
      initLucideIcons();

      try {
        // Connect with backend REST API: POST /api/auth/login
        const result = await ApiService.login(email, password);
        setCurrentUser(result.user, result.token);
        showToast("Welcome Back", `Signed in as ${result.user.name}. Opening studio...`, "success");
        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 800);
      } catch (err) {
        showInputError("loginPassword", err.message || "Invalid credentials provided.");
        showToast("Authentication Failed", err.message || "Invalid credentials.", "error");
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        initLucideIcons();
      }
    });
  }
}

// --- 8. Page 3: Register Page Controller (Connected with Backend API) ---
async function initRegisterPage() {
  await checkBackendConnection();
  const registerForm = document.getElementById("registerForm");
  const nameInput = document.getElementById("regName");
  const emailInput = document.getElementById("regEmail");
  const passwordInput = document.getElementById("regPassword");
  const confirmPasswordInput = document.getElementById("regConfirmPassword");
  const termsCheckbox = document.getElementById("regTerms");
  const passwordToggle = document.getElementById("toggleRegPasswordBtn");
  const submitBtn = document.getElementById("regSubmitBtn");

  if (passwordToggle && passwordInput) {
    passwordToggle.addEventListener("click", () => {
      const isPassword = passwordInput.type === "password";
      passwordInput.type = isPassword ? "text" : "password";
      if (confirmPasswordInput) confirmPasswordInput.type = isPassword ? "text" : "password";
      passwordToggle.innerHTML = isPassword ? '<i data-lucide="eye-off"></i>' : '<i data-lucide="eye"></i>';
      initLucideIcons();
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearFormErrors();

      const name = nameInput.value.trim();
      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();
      const confirmPassword = confirmPasswordInput.value.trim();
      const termsAccepted = termsCheckbox.checked;

      let isValid = true;

      if (!name) {
        showInputError("regName", "Full Name is required.");
        isValid = false;
      }

      if (!email) {
        showInputError("regEmail", "Email address is required.");
        isValid = false;
      } else if (!isValidEmail(email)) {
        showInputError("regEmail", "Please enter a valid email address.");
        isValid = false;
      }

      if (!password) {
        showInputError("regPassword", "Password is required.");
        isValid = false;
      } else if (password.length < 8) {
        showInputError("regPassword", "Password must be at least 8 characters long.");
        isValid = false;
      }

      if (password !== confirmPassword) {
        showInputError("regConfirmPassword", "Passwords do not match.");
        isValid = false;
      }

      if (!termsAccepted) {
        showInputError("regTerms", "You must accept the Terms and Conditions.");
        isValid = false;
      }

      if (!isValid) return;

      const originalBtnText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<span style="display: inline-flex; align-items: center; gap: 0.5rem;"><i data-lucide="sun"></i> Creating Account...</span>';
      submitBtn.disabled = true;
      initLucideIcons();

      try {
        // Connect with backend REST API: POST /api/auth/register
        const result = await ApiService.register(name, email, password);
        showToast("Account Created", result.message || "Registration successful! Redirecting...", "success");
        setTimeout(() => {
          window.location.href = "login.html";
        }, 1100);
      } catch (err) {
        if (err.message && err.message.toLowerCase().includes('already exists')) {
          showInputError("regEmail", err.message);
        } else {
          showToast("Registration Error", err.message || "Registration failed.", "error");
        }
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        initLucideIcons();
      }
    });
  }
}

function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function showInputError(inputId, message) {
  const input = document.getElementById(inputId);
  if (input) {
    input.classList.add("error");
    const parent = input.closest(".form-group") || input.parentElement;
    const errorMsg = parent.querySelector(".form-error-msg");
    if (errorMsg) {
      errorMsg.innerHTML = `<i data-lucide="alert-circle" style="width: 14px; height: 14px;"></i> ${message}`;
      errorMsg.classList.add("visible");
    }
  }
  initLucideIcons();
}

function clearFormErrors() {
  document.querySelectorAll(".form-control.error").forEach(el => el.classList.remove("error"));
  document.querySelectorAll(".form-error-msg.visible").forEach(el => {
    el.classList.remove("visible");
    el.innerHTML = "";
  });
}

// --- 9. Page 4: Dashboard Page Controller (Connected with Backend API) ---
let currentDeleteBlogId = null;

async function initDashboardPage() {
  await checkBackendConnection();
  let user = getCurrentUser();
  const token = getAuthToken();

  if (!user || !token) {
    showToast("Authentication Required", "Please sign in to access your author studio.", "info");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 900);
    return;
  }

  // Verify session in background with JWT
  ApiService.verifySession().then(liveUser => {
    if (liveUser) {
      setCurrentUser(liveUser, token);
    }
  });

  const userNameElements = document.querySelectorAll(".user-name-display");
  const userEmailElements = document.querySelectorAll(".user-email-display");
  const userAvatarElements = document.querySelectorAll(".user-avatar-display");

  userNameElements.forEach(el => el.textContent = user.name);
  userEmailElements.forEach(el => el.textContent = user.email);
  userAvatarElements.forEach(el => el.src = user.avatar);

  const sidebarToggle = document.querySelector(".sidebar-toggle-btn");
  const sidebar = document.querySelector(".dash-sidebar");
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener("click", () => {
      sidebar.classList.toggle("mobile-open");
    });
  }

  // Load stats and blogs via REST APIs
  await updateDashboardStats();
  await renderDashboardBlogs();

  const searchInput = document.getElementById("dashboardSearchInput");
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const query = e.target.value.toLowerCase();
        renderDashboardBlogs("all", query);
      }, 250);
    });
  }

  const filterPills = document.querySelectorAll(".filter-pill");
  filterPills.forEach(pill => {
    pill.addEventListener("click", async () => {
      filterPills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      const status = pill.getAttribute("data-status");
      await renderDashboardBlogs(status);
    });
  });

  const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", async () => {
      if (currentDeleteBlogId) {
        await deleteBlog(currentDeleteBlogId);
        closeModal("deleteConfirmModal");
        currentDeleteBlogId = null;
      }
    });
  }
}

async function updateDashboardStats() {
  const stats = await ApiService.getStats();

  const totalEl = document.getElementById("statTotalBlogs");
  const pubEl = document.getElementById("statPublishedBlogs");
  const draftEl = document.getElementById("statDraftBlogs");
  const viewsEl = document.getElementById("statTotalViews");

  if (totalEl) totalEl.textContent = stats.total;
  if (pubEl) pubEl.textContent = stats.published;
  if (draftEl) draftEl.textContent = stats.drafts;
  if (viewsEl) viewsEl.textContent = stats.views.toLocaleString();
}

async function renderDashboardBlogs(statusFilter = "all", searchQuery = "") {
  const tableBody = document.getElementById("dashboardBlogsTableBody");
  const emptyState = document.getElementById("dashboardEmptyState");
  const tableContainer = document.getElementById("dashboardTableContainer");

  if (!tableBody) return;

  const blogs = await ApiService.getBlogs({ status: statusFilter, search: searchQuery });

  if (!blogs || blogs.length === 0) {
    if (tableContainer) tableContainer.style.display = "none";
    if (emptyState) emptyState.style.display = "block";
    return;
  }

  if (tableContainer) tableContainer.style.display = "block";
  if (emptyState) emptyState.style.display = "none";

  tableBody.innerHTML = blogs.map(blog => {
    const isPublished = blog.status === "published";
    const statusBadge = isPublished
      ? `<span class="badge badge-published"><i data-lucide="check" style="width: 12px; height: 12px;"></i> Published</span>`
      : `<span class="badge badge-draft"><i data-lucide="clock" style="width: 12px; height: 12px;"></i> Draft</span>`;

    return `
      <tr>
        <td>
          <div class="blog-row-title-cell">
            <img src="${blog.coverImage}" alt="${blog.title}" class="blog-row-thumbnail">
            <span class="blog-row-title-text">${blog.title}</span>
          </div>
        </td>
        <td>
          <span class="badge badge-${blog.category.toLowerCase()}">${blog.category}</span>
        </td>
        <td style="color: var(--secondary-text); font-size: 0.85rem;">${blog.date}</td>
        <td>${statusBadge}</td>
        <td style="color: var(--secondary-text); font-size: 0.85rem;">
          <i data-lucide="eye" style="width: 14px; height: 14px; vertical-align: -2px;"></i> ${blog.views || 0}
        </td>
        <td>
          <div class="blog-row-actions">
            <button class="action-btn" title="Preview Story" onclick="openStoryPreviewModal('${blog.id}')">
              <i data-lucide="eye"></i>
            </button>
            <a href="create-blog.html?id=${blog.id}" class="action-btn" title="Edit Story">
              <i data-lucide="edit-2"></i>
            </a>
            <button class="action-btn delete-btn" title="Delete Story" onclick="triggerDeleteModal('${blog.id}')">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  initLucideIcons();
}

function triggerDeleteModal(blogId) {
  currentDeleteBlogId = blogId;
  openModal("deleteConfirmModal");
}

async function deleteBlog(blogId) {
  try {
    await ApiService.deleteBlog(blogId);
    await updateDashboardStats();
    await renderDashboardBlogs();
    showToast("Story Removed", "The story was deleted via REST API.", "info");
  } catch (err) {
    showToast("Delete Error", err.message || "Failed to delete story.", "error");
  }
}

// --- 10. Page 5: Create / Edit Blog Controller (Connected with Backend API) ---
const COVER_PRESETS = [
  { name: "Botanicals", url: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80" },
  { name: "Coffee & Books", url: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80" },
  { name: "Ceramics", url: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=800&q=80" },
  { name: "Skincare", url: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80" },
  { name: "Travel", url: "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=800&q=80" },
  { name: "Cuisine", url: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80" }
];

async function initEditorPage() {
  await checkBackendConnection();
  const user = getCurrentUser();
  const token = getAuthToken();

  if (!user || !token) {
    showToast("Authentication Required", "Please sign in to write or edit stories.", "info");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 900);
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get("id");

  const titleInput = document.getElementById("blogTitleInput");
  const categorySelect = document.getElementById("blogCategorySelect");
  const excerptInput = document.getElementById("blogExcerptInput");
  const coverUrlInput = document.getElementById("blogCoverUrlInput");
  const contentInput = document.getElementById("blogContentInput");
  const coverImgPreview = document.getElementById("coverImgPreview");
  const coverPlaceholder = document.getElementById("coverPlaceholder");

  const wordCountDisplay = document.getElementById("wordCountDisplay");
  const readTimeDisplay = document.getElementById("readTimeDisplay");
  const editorHeading = document.getElementById("editorPageHeading");

  let editingBlog = null;

  function updateCoverPreview(url) {
    if (url && (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("images/"))) {
      coverImgPreview.src = url;
      coverImgPreview.style.display = "block";
      if (coverPlaceholder) coverPlaceholder.style.display = "none";
    } else {
      coverImgPreview.style.display = "none";
      if (coverPlaceholder) coverPlaceholder.style.display = "block";
    }
  }

  const presetContainer = document.getElementById("coverPresetsContainer");
  if (presetContainer) {
    presetContainer.innerHTML = COVER_PRESETS.map(p => `
      <button type="button" class="preset-chip" data-url="${p.url}">
        ${p.name}
      </button>
    `).join("");

    presetContainer.querySelectorAll(".preset-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const url = btn.getAttribute("data-url");
        coverUrlInput.value = url;
        updateCoverPreview(url);
      });
    });
  }

  if (coverUrlInput) {
    coverUrlInput.addEventListener("input", (e) => {
      updateCoverPreview(e.target.value.trim());
    });
    updateCoverPreview(coverUrlInput.value.trim());
  }

  if (editId) {
    editingBlog = await ApiService.getBlog(editId);
    if (editingBlog) {
      if (editorHeading) editorHeading.textContent = "Edit Your Story";
      document.title = "Edit Story – BlogSpace";
      titleInput.value = editingBlog.title;
      categorySelect.value = editingBlog.category;
      excerptInput.value = editingBlog.excerpt || "";
      coverUrlInput.value = editingBlog.coverImage || "";
      contentInput.value = editingBlog.content;
      updateCoverPreview(editingBlog.coverImage);
      updateCounts();
    }
  }

  function updateCounts() {
    const text = contentInput.value;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    if (wordCountDisplay) wordCountDisplay.textContent = `${words} words · ${chars} characters`;
    if (readTimeDisplay) readTimeDisplay.textContent = calculateReadTime(text);
  }

  if (contentInput) {
    contentInput.addEventListener("input", updateCounts);
  }

  const toolbarButtons = document.querySelectorAll(".toolbar-btn");
  toolbarButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-action");
      applyFormatting(action, contentInput);
      updateCounts();
    });
  });

  const saveDraftBtn = document.getElementById("saveDraftBtn");
  const publishBtn = document.getElementById("publishBlogBtn");
  const previewBtn = document.getElementById("previewBlogBtn");

  if (saveDraftBtn) {
    saveDraftBtn.addEventListener("click", () => handleSaveBlog("draft"));
  }

  if (publishBtn) {
    publishBtn.addEventListener("click", () => handleSaveBlog("published"));
  }

  if (previewBtn) {
    previewBtn.addEventListener("click", () => {
      const title = titleInput.value.trim() || "Untitled Narrative";
      const category = categorySelect.value || "Lifestyle";
      const cover = coverUrlInput.value.trim() || COVER_PRESETS[0].url;
      const content = contentInput.value.trim() || "Your prose will unfold here...";
      
      const mockBlog = {
        id: "preview_temp",
        title: title,
        category: category,
        coverImage: cover,
        content: content,
        date: getFormattedDateNow(),
        readTime: calculateReadTime(content),
        author: getCurrentUser() || DEFAULT_USERS[0]
      };

      const modal = document.getElementById("storyPreviewModal");
      if (modal) {
        const body = modal.querySelector(".modal-body");
        const badgeClass = `badge-${category.toLowerCase()}`;
        const formattedContent = content
          .split("\n\n")
          .map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`)
          .join("");

        body.innerHTML = `
          <img src="${cover}" alt="${title}" class="preview-cover-img">
          <div class="preview-meta-row">
            <span class="badge ${badgeClass}">${category}</span>
            <span style="font-size: 0.85rem; color: var(--secondary-text);">${mockBlog.date} &bull; ${mockBlog.readTime}</span>
          </div>
          <h1 class="preview-title">${title}</h1>
          <div class="preview-content">${formattedContent}</div>
        `;
        openModal("storyPreviewModal");
      }
    });
  }

  async function handleSaveBlog(targetStatus) {
    clearFormErrors();

    const title = titleInput.value.trim();
    const category = categorySelect.value;
    const excerpt = excerptInput.value.trim();
    const coverImage = coverUrlInput.value.trim() || COVER_PRESETS[0].url;
    const content = contentInput.value.trim();

    let isValid = true;

    if (!title) {
      showInputError("blogTitleInput", "Please provide a title for your story.");
      isValid = false;
    }

    if (!category) {
      showInputError("blogCategorySelect", "Please select a category.");
      isValid = false;
    }

    if (!content) {
      showInputError("blogContentInput", "Story content cannot be empty.");
      isValid = false;
    }

    if (!isValid) {
      showToast("Submission Incomplete", "Please complete all required fields.", "error");
      return;
    }

    const user = getCurrentUser();
    if (!user) {
      showToast("Authentication Required", "Please sign in to publish or draft stories.", "error");
      setTimeout(() => { window.location.href = "login.html"; }, 900);
      return;
    }

    const blogPayload = {
      title,
      category,
      excerpt: excerpt || content.substring(0, 140) + '...',
      coverImage,
      content,
      status: targetStatus,
      author: {
        name: user.name,
        role: user.role || 'Essayist',
        avatar: user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
      }
    };

    try {
      if (editingBlog) {
        // Connect to PUT /api/blogs/:id
        await ApiService.updateBlog(editingBlog.id, blogPayload);
      } else {
        // Connect to POST /api/blogs (Create Blog)
        await ApiService.createBlog(blogPayload);
      }

      const msg = targetStatus === "published" 
        ? "Story published to the global circle via REST API." 
        : "Draft saved to your studio via REST API.";
      showToast("Story Preserved", msg, "success");

      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 850);
    } catch (err) {
      showToast("Save Error", err.message || "Failed to save blog.", "error");
    }
  }
}

function applyFormatting(action, textarea) {
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selection = text.substring(start, end);

  let replacement = "";
  switch (action) {
    case "bold":
      replacement = `**${selection || "bold prose"}**`;
      break;
    case "italic":
      replacement = `*${selection || "italic prose"}*`;
      break;
    case "h2":
      replacement = `\n\n## ${selection || "Section Heading"}\n`;
      break;
    case "h3":
      replacement = `\n\n### ${selection || "Sub-Chapter"}\n`;
      break;
    case "quote":
      replacement = `\n> ${selection || "An enduring quote..."}\n`;
      break;
    case "list":
      replacement = `\n- ${selection || "Essence item"}\n`;
      break;
    case "code":
      replacement = `\`\`\`\n${selection || "Reflective excerpt"}\n\`\`\``;
      break;
    default:
      return;
  }

  textarea.value = text.substring(0, start) + replacement + text.substring(end);
  textarea.focus();
}

// --- Global Initialization on DOM Ready ---
document.addEventListener("DOMContentLoaded", () => {
  initStorage();
  initLucideIcons();

  const path = window.location.pathname.toLowerCase();
  if (path.endsWith("login.html")) {
    initLoginPage();
  } else if (path.endsWith("register.html")) {
    initRegisterPage();
  } else if (path.endsWith("dashboard.html")) {
    initDashboardPage();
  } else if (path.endsWith("create-blog.html")) {
    initEditorPage();
  } else {
    initHomePage();
  }
});
