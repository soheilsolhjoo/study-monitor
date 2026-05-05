# <img src="study_monitor.png" alt="Study Monitor Logo" height="30"> Study Monitor
*Made by Soheil Solhjoo (2026)*

**Study Monitor** is a simple, powerful, privacy-first, locally hosted web application designed to track learning progress across multiple subjects. Whether you are tracking study hours, pages read, or completed curriculum modules, Study Monitor adapts to your workflow.

## ✨ Features
- **Multi-Subject Workspaces:** Create distinct profiles for different subjects (e.g., Language Learning, UI Design, Math) within the same app.
- **Flexible Tracking Modes:** 
  - *Time Mode:* Input minutes studied and view your progress in `HH:MM`.
  - *Unit Mode:* Track natural numbers like pages, flashcards, or exercises.
  - *Auto Mode:* Automatically calculates progress strictly based on completed chapters/modules.
- **Interactive Curriculum Grid:** Visually track chapter completion with a clickable grid.
- **Data Visualization:** Built-in Chart.js line graph and milestones tracker to visualize your study velocity over time.
- **Dark Mode:** Easy on the eyes for late-night study sessions.
- **100% Local & Secure:** Runs entirely in your browser. No databases, no forced accounts, no tracking.
- **Cloud Sync:** Optional GitHub Gist integration for cross-device synchronization.

---

## ☁️ How to Set Up Cloud Sync

You can use Study Monitor perfectly fine locally by using the "Save to File" and "Load File" buttons. However, if you want to seamlessly sync your progress between your laptop and desktop, follow these steps:

### Step 1: Create a GitHub Gist
1. Log into GitHub and go to gist.github.com.
2. Name the file `hour_bank_data.json`.
3. In the content box, simply type `{}`.
4. Click **Create secret gist**.
5. Look at the URL of your new Gist (e.g., `https://gist.github.com/Username/8b3c9d7...`). Copy the long string of characters at the very end. **This is your Gist ID.**

### Step 2: Create a Personal Access Token
1. Go to your GitHub **Settings** > **Developer settings** > **Personal access tokens** > **Fine-grained tokens**.
2. Click **Generate new token**.
3. Name it "Study Monitor Sync" and set an expiration date.
4. Under **Account permissions**, find **Gists** and set it to **Read and write**.
5. Click **Generate token** at the bottom.
6. Copy the generated token (`ghp_...`). *Note: You will only see this token once!*

### Step 3: Connect the App
1. Open `index.html` in your browser.
2. Click **⚙️ Cloud Settings** in the top navigation bar.
3. Paste your Token and your Gist ID into the respective fields and click Save.
4. You're done! You can now click **📤 Push to Cloud** and **📥 Pull from Cloud** anytime to manually sync your data.
