# CüS Treasure
### Treasure by CüS Studio

**Know Where You Stand.**

CüS Treasure is a mobile-first personal finance application designed to help individuals understand, organise, and track their financial lives through a clean, intuitive, and modern interface.

Built under **CüS Studio**, the project focuses on making personal finance easier to understand, more transparent to manage, and accessible from everyday devices.

---

## ✨ Project Vision

CüS Treasure aims to bring essential personal finance tools together in one place.

The long-term vision includes:

- 💰 Income and expense tracking
- 📊 Financial summaries and spending insights
- 🎯 Savings goals and progress tracking
- 🗓️ Transaction history and financial activity
- 🤖 AI-powered financial assistance
- 🔔 Notifications and useful reminders
- 🔐 Secure authentication and personal data management
- 📱 A responsive, mobile-first experience

**Important:** These are project goals. Individual features may still be under development and should not be assumed to be fully functional.

---

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| React | User interface |
| TypeScript | Type safety |
| Vite | Development and production builds |
| Supabase | Backend services, authentication and database |
| CSS | Responsive styling and interface design |
| Vercel | Deployment and hosting |

---

## 🚀 Deployment with Vercel

The project is designed to be deployable through Vercel without requiring a local terminal.

### Step 1 — Import the repository

1. Open Vercel.
2. Import your GitHub repository.
3. Select **Vite** as the framework preset.
4. Set the build command to:

   `npm run build`

5. Set the output directory to:

   `dist`

6. Deploy the project.

### Step 2 — Configure environment variables

Open your Vercel project settings and add the following environment variables:

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase publishable/anonymous client key, as applicable to your project configuration |

Use the values from your own Supabase project.

After adding or changing environment variables, trigger