# 🌿 BlogSpace – Earthy Luxe Editorial Publication

> **Frontend Engineering Internship Assignment – Task 1 Redesign**  
> **Theme:** Earthy Luxe – Muted Sage Grey, Warm Cream, Warm Beige & Deep Burgundy  
> Built with pure **HTML5, CSS3, and Vanilla JavaScript** (Zero Framework Dependencies).

---

## 📖 1. Design Identity & Concept

**BlogSpace** has been redesigned as an **Earthy Luxe independent lifestyle magazine and sophisticated publishing platform**. 

The aesthetic is inspired by premium print journals (such as *Kinfolk*, *Cereal*, and *Apartamento*), independent boutique brands, and thoughtful digital essay collections.

### 🎨 Strict Colour Palette

| Color Name | Hex Code | Role in Application |
| :--- | :--- | :--- |
| **Warm Cream** | `#F7F2E8` | Main page background, navigation background, section base |
| **White Cream** | `#FFFCF6` | Card backgrounds, editor background, form containers, button text |
| **Warm Beige** | `#D8C8B4` | Delicate borders, category tags, input outlines, dividers |
| **Muted Sage Grey** | `#A3AA98` | Secondary buttons, icons, hover accents, subtle badges |
| **Deep Burgundy** | `#641E32` | Primary brand accent, primary CTA buttons, active links, header logo |
| **Soft Charcoal** | `#35382F` | Main editorial headings, high-contrast readable titles |
| **Secondary Text** | `#706E63` | Subtitles, author roles, dates, meta indicators |
| **Light Sage** | `#E6E8DE` | Highlight section background, soft tag fills, category pills |
| **Muted Beige** | `#EAE1D5` | Subtle category backgrounds, card hover tints |

### 🖋️ Typography
- **Headings:** *Playfair Display* & *Cormorant Garamond* (Graceful serif typography, generous line-heights, gentle italic nuances).
- **Body & Controls:** *DM Sans* & *Lato* (Clean, airy, accessible proportions with comfortable reading cadence).

---

## 🌟 2. Key Pages & Features

### 🏠 1. The Journal (`index.html`)
- **Sophisticated Editorial Hero Section:**
  - Headline: *"Stories That Inspire. Ideas That Stay."*
  - Supporting text: *"A thoughtful space for stories, discoveries, creativity and everyday inspiration."*
  - Primary CTA: Deep Burgundy **Explore Stories** button.
  - Secondary CTA: **Start Writing** button.
  - Hero photography: Warm linen, morning coffee, dried florals, and minimal reading desk.
- **Popular Categories Bar:** Minimalist cards for **Lifestyle**, **Beauty**, **Fashion**, **Food**, **Travel**, and **Creativity**.
- **Editorial Curated Feed (6+ Blogs):** Asymmetric, elegant blog cards with categories, timestamps, read times, author avatars, and **Read Story** modal reader.
- **Curated Editorial Highlight:** Full-bleed dispatch card featuring coastal European travel narratives.
- **Brand Pillars:** Distraction-Free Sanctuary, Thoughtful Readership, and Organic Pace.
- **Footer:** Deep Burgundy background with warm cream typography, social links, and Sunday Journal newsletter subscribe form.

### 🔐 2. Authentication – Sign In (`login.html`)
- **Split-Screen Editorial Layout:** Left showcase with brand pillars, warm lifestyle visual, and testimonial; right clean form card.
- **1-Click Evaluator Auto-Fill:** Quick button populating demo account (`alex@blogspace.io` / `password123`).
- **Show/Hide Password:** Visibility toggle with zero console errors.
- **Client-Side Validation:** Valid email syntax, required fields, and friendly inline error feedback.

### 📝 3. Authentication – Membership (`register.html`)
- **Matching Earthy Aesthetic:** Visual harmony with the login page.
- **Inputs:** Full Name, Email, Password (minimum 8 characters), Confirm Password, and Terms checkbox.
- **Data Persistence:** Registers new authors into browser `localStorage` and routes to login.

### 📊 4. Author Studio Dashboard (`dashboard.html`)
- **Editorial Publishing Desk:**
  - Warm cream sidebar with Burgundy active states and muted sage icons.
  - Personalized Greeting: *"Good Morning, Writer."*
  - Subtitle: *"Your creative space, your stories, your journey."*
- **Minimal Elegant Statistics:**
  - **Total Stories:** Calculated sum of all articles.
  - **Published Stories:** Count of live articles.
  - **Drafts:** Count of unpublished manuscripts.
  - **Total Views:** Organic readership impression counter.
- **Story Management:** Real-time search, status tabs (*All Stories*, *Published*, *Drafts*), preview modal, edit button, and delete confirmation dialog.

### ✍️ 5. Story Studio Editor (`create-blog.html`)
- **Distraction-Free Canvas:**
  - Heading: *"Create Something Beautiful."*
  - Subtitle: *"Every great story begins with an idea."*
- **Visual Presets:** 1-click lifestyle & botanical photography presets (*Botanicals*, *Coffee & Books*, *Ceramics*, *Skincare*, *Travel*, *Cuisine*).
- **Prose Toolbar:** Markdown shortcuts for Bold, Italic, Headings, Pull Quotes, Lists, and Excerpts.
- **Live Footer Metrics:** Instant word count, character count, and calculated reading time.
- **Save Actions:** Save as Draft or Publish to live journal.

---

## 🛠️ 3. Technologies Used

- **HTML5:** Semantic document landmarks (`<header>`, `<main>`, `<section>`, `<article>`, `<aside>`, `<footer>`).
- **CSS3:** Native CSS variables, Flexbox, Grid, editorial media queries (zero Tailwind/Bootstrap).
- **Vanilla JavaScript (ES6+):** Pure DOM manipulation, data modeling, `localStorage` persistence, modal controller, and offline SVG vector generator.

---

## 🚀 4. How to Run Locally

1. Open `index.html` directly in any web browser.
2. Or run a local HTTP server:
   ```bash
   python -m http.server 8000
   ```
   Open `http://localhost:8000` in your browser.

---

## 🔑 5. Evaluator Test Account

- **Email:** `alex@blogspace.io`
- **Password:** `password123`
- *(Or click the **Auto Fill** button on the Login page).*

---

## 📁 6. Folder Structure

```
task1/
├── index.html          # Public journal & lifestyle magazine homepage
├── login.html          # Split-screen editorial login
├── register.html       # Split-screen author registration
├── dashboard.html      # Author studio workspace & story management
├── create-blog.html    # Distraction-free writing canvas
├── css/
│   └── style.css       # Earthy Luxe editorial design system
├── js/
│   └── script.js       # LocalStorage data manager & UI controllers
├── images/
│   └── logo.svg        # Deep burgundy & warm cream vector brand emblem
└── README.md           # Documentation & design identity guide
```
