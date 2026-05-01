# Application Architecture

This document provides a deep dive into how the Data Analytic Chatbot works under the hood.

## 1. Authentication & Onboarding Flow
The app uses a strict "Gatekeeper" pattern to ensure every user has a completed profile before they can see the dashboard.

1.  **Login**: User signs in via Email or Google.
2.  **Auth Callback**: Supabase handles the OAuth handshake and redirects back to the app.
3.  **Route Guards**: Middleware redirects unauthenticated users away from protected entry points:
    -   `/` → `/welcome`
    -   `/onboarding` requires a valid session
4.  **Onboarding Check**: In `app/page.js`, the app checks if `profile.onboarding_completed` is `true`.
    -   If `false`, the user is forced to `/onboarding`.
    -   If `true`, the user stays on the dashboard.
5.  **Onboarding Page**: Collects a unique `username` and `nickname`. It uses `upsert` to ensure a profile exists in the database.

## 2. Role-Based Access Control (RBAC)
The app can hide data based on who is looking at it.

### Roles
-   **Owner**: Total access. Bypasses all filters.
-   **Admin**: Full access. Can manage permissions for others.
-   **User**: Restricted access. Can only see columns explicitly granted to them.

### Column Permissions
Permissions are stored in the `column_permissions` table:
-   `file_id`: Links to a specific file.
-   `role`: The role being targeted (usually 'user').
-   `allowed_columns`: A list of column names allowed for that role.

### The Filter Logic
When a restricted user previews a file or talks to the AI:
1.  The app fetches data from `column_permissions` for that `file_id` and the user's `role`.
2.  **Chat**: The AI is ONLY sent the headers of the `allowed_columns`.
3.  **Preview**: The UI table ONLY renders columns that are in the `allowed_columns` list.

## 3. Data Flow (Upload to AI)
1.  **Selection**: User selects a CSV or XLSX file.
2.  **Upload**: The file is stored in Supabase Storage (`data-files` bucket).
3.  **Reference**: A row is added to `user_files` with the file metadata and storage path.
4.  **Context**: When a file is "Selected" in chat, the app downloads the first few rows (or headers), filters them based on permissions, and turns them into an allowed schema context for the backend.

## 4. Hybrid Analytics Flow
The chat endpoint now follows a structured-query pipeline instead of executing model-written SQL.

1.  **Frontend**: `/api/chat` receives the user question, chat history, and schema context.
2.  **AI Planner** (`lib/aiService.js`): Gemini receives the question plus the allowed schema and returns JSON only.
3.  **Validation Layer** (`lib/queryBuilder.js`): The backend validates the JSON shape, table names, column names, operators, and operations.
4.  **Routing Layer** (`lib/controller.js`):
    -   `type: "query"` goes through a safe query plan.
    -   `type: "analysis"` fetches raw data first, then sends it to Python.
5.  **Execution Layer**:
    -   **Supabase** queries run through the query builder and aggregate safely in Node.js.
    -   **Azure MySQL** queries use parameterized SQL only.
    -   **Python** analysis runs in `lib/analysisService.py` with pandas.
        Supported analysis types are `trend`, `comparison`, `distribution`, `composition`, `outlier`, `correlation`, `period_change`, and `data_quality`.
        `correlation` can request a `second_column`, while `trend`, `comparison`, `composition`, and `period_change` require `group_by`.
        `data_quality` may omit `column` to run a table-wide quality check.
6.  **Formatting** (`lib/resultFormatter.js`): Results are returned as JSON and also converted into a markdown-friendly assistant message for the UI.

## 5. Database Schema Map
-   **`auth.users`** (Internal): Managed by Supabase.
-   **`public.profiles`**: Custom user data (Username, Role, Onboarding Status). Linked to `auth.users.id`.
-   **`public.user_files`**: Metadata for uploaded files (Filename, Storage Path).
-   **`public.conversations`**: Stores chat threads.
-   **`public.messages`**: Stores individual messages within a conversation.
-   **`public.column_permissions`**: Stores which roles can see which columns for each file.
