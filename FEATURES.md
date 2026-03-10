# Features & Implementation Status

## 🟢 Core Functionality
- **Dynamic News Feed**: Fetches the latest 10 articles from Firestore, ordered by date.
- **Article Viewer**:
  - Supports lookup by **ID** or **Slug**.
  - **Block-Based Rendering**: Handles Text (Rich HTML), Image, and Video blocks.
  - **Dynamic Metadata**: Updates page title based on article content.
- **Responsive Design**: Mobile-friendly layout with a sticky header and grid-based article list.

## 🛡️ Admin Panel
- **Secure Authentication**: Google Sign-In restricted to a specific Admin UID (`KvgaucrF9GdnXMbX4MtijnYrFYp2`).
- **Dashboard**:
  - **Search**: Real-time filtering of articles by title.
  - **Tabs**: Filter by `All`, `Live`, `Draft`, and `Scheduled` status.
  - **CRUD Operations**: Create, Read, Update, Delete articles.

## ✍️ Content Editor
- **Block-Based Editor**:
  - **Text**: Rich text input support.
  - **Image**: Upload to Firebase Storage or use external URL.
  - **Video**: Embed YouTube/MP4 via URL or file upload.
  - **Reordering**: Move blocks up/down.
- **Smart Publish**:
  - **URL Import**: Fetches content from external URLs via CORS proxy.
  - **Auto-Extraction**: Parses metadata (OG tags), main image, video, and body content into blocks automatically.
- **Live Edit Mode**: Floating "Edit" button on article pages allows admins to edit content directly on the frontend.

## ⚙️ Technical
- **Tech Stack**: Vanilla JavaScript (ES Modules), CSS Variables, HTML5.
- **Backend**: Firebase (Firestore, Authentication, Storage).
- **Security**: Firestore Rules configured for public read-only access and admin-only write access.
