# Data Analytic Chatbot

A powerful Next.js application that combines AI-driven chat with robust data analysis.

## 🚀 Key Features
- **AI Chatbot**: Powered by Google's Gemini AI for intelligent data conversations.
- **Structured Analytics**: Safe natural-language queries for `select`, `count`, `average`, and `sum`.
- **Python Analysis**: Built-in `trend`, `comparison`, `distribution`, `composition`, `outlier`, and `correlation` analysis modes.
- **Data Center**: Upload CSV and Excel files to Supabase Storage.
- **Real-time Preview**: View your uploaded data directly in the app.
- **Onboarding Flow**: Beautiful onboarding for initial profile setup (Username/Nickname).
- **Google Auth**: Secure authentication via Supabase and Google OAuth.

## 🛠 Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth + Google OAuth
- **Storage**: Supabase Storage (for CSV/XLSX files)
- **AI**: Google Generative AI (Gemini)
- **Styling**: Vanilla CSS + Tailwind Utility Classes
- **Icons**: Lucide React

## 📂 Project Structure
- `/app`: Global application pages and shared components.
- `/app/onboarding`: User profile setup for new Google accounts.
- `/lib`: Supabase and Auth utility functions.
- `/public`: Static assets.

## ⚙️ Setup & Configuration

### Environment Variables
Create a `.env.local` file with the following:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key

# Optional: declare the allowed analytics schema for secure planning/validation
CHATBOT_ALLOWED_SCHEMA=[{"name":"sales","provider":"supabase","columns":[{"name":"region","type":"string"},{"name":"revenue","type":"number"},{"name":"sale_date","type":"date"}]}]

# Optional: use mysql-backed tables when provider="mysql"
AZURE_MYSQL_HOST=your-server.mysql.database.azure.com
AZURE_MYSQL_PORT=3306
AZURE_MYSQL_USER=your_user
AZURE_MYSQL_PASSWORD=your_password
AZURE_MYSQL_DATABASE=your_database
```

For Python analysis, install `pandas` in the runtime environment:
```bash
pip install pandas
```

### Database Setup
Run the SQL scripts located in the artifacts directory (or see `ARCHITECTURE.md` for schema details) in your Supabase SQL Editor.

## 📖 Learn More
Check out [ARCHITECTURE.md](./ARCHITECTURE.md) for a deep dive into how everything works behind the scenes.

### Routing notes
- Unauthenticated users who hit `/` are redirected to `/welcome`.
- `/onboarding` requires an authenticated session (the page itself still decides whether onboarding is required based on `profiles.onboarding_completed`).
