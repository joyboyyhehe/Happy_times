# Happy Times Preschool — Standalone Registration Portal

This directory contains the completely self-contained, high-performance, standalone parent registration and child enrollment form. It is designed to be hosted independently on static hosts (like **Render**, **Netlify**, **Vercel**, or **GitHub Pages**) with **zero build steps** and **instant (under 50ms) load times**.

---

## 🚀 Key Features

1. **Pre-configured Production Connection**:
   - Out of the box, it connects directly to your production Firebase Firestore project `happytimes-preschool-pwa`.
   - Uses optimized compat Web CDN scripts for high compatibility across all modern desktop and smartphone screens.

2. **Mobile SMS OTP Verification**:
   - Enforces SMS verification during the parent details step.
   - Built-in invisible Google reCAPTCHA protects against bot spam.
   - Verifies the parent's phone number before allowing form submissions, ensuring zero fake registrations in your database.

3. **Premium Visual Interface**:
   - Sleek and responsive card layout styled with Tailwind CSS and custom glassmorphism parameters.
   - Micro-animations, sliding step transitions, and clear tap-feedback actions.
   - Standard Lucide Icons loaded dynamically.

4. **Zero-Overhead Static Architecture**:
   - Standard HTML5 / CSS3 / ES6. No heavy framework bundler, transpiler, or `node_modules` required!

---

## 📂 Project Structure

- 📄 **`index.html`** — Holds the page structure, Tailwind CDN, Lucide CDN, and Firebase SDK imports.
- 🎨 **`style.css`** — Defines custom design styles, background floating orbs, sliding step transitions, keyframe animations, and HSL tokens.
- ⚡ **`app.js`** — Implements phone OTP request & validation rules, multi-step navigation controls, field formatting, and Firestore collection writes.

---

## 🛠️ How to Deploy in 2 Seconds

### Option A: Render Hosting (Recommended Static Site)
1. Push this `standalone-registration` folder or its contents up to a new GitHub repository.
2. Log into your **Render Dashboard** (`dashboard.render.com`).
3. Click **"New +"** and select **"Static Site"**.
4. Connect your new GitHub repository.
5. In the settings:
   - **Build Command**: *Leave blank*
   - **Publish Directory**: `.` (or the folder name if nested)
6. Click **"Create Static Site"**. It is now live on your custom `.onrender.com` domain!

### Option B: Netlify or Vercel
1. Drag and drop the `standalone-registration` folder directly into **Netlify Drop** (`app.netlify.com/drop`) or **Vercel Import** to deploy instantly!

---

## 🔒 Security Specifications
- Document creation writes to the `/registrations` collection.
- Reads are restricted to ensure parent data privacy.
- Captures the verified Firebase Auth UID of the parent upon phone validation, allowing seamless whitelisting and auto-linking when approved by the administration.
