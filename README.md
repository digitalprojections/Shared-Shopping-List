# ShopShare 🛒

ShopShare is a premium, real-time shared shopping list application built with React, Vite, and Firebase. It allows users to create collections, manage items with quantities, and share access with others seamlessly.

## Features

- **Real-time Sync**: Collaborative shopping with instant updates across all devices.
- **Shared Collections**: Create multiple lists for different occasions (e.g., Groceries, Weekend Trip).
- **Flexible Permissions**: Share lists with "Read Only" or "Can Edit" access.
- **Offline Support**: Uses local database for snappy performance and offline editing.
- **Premium Design**: Modern, vibrant UI with smooth animations and responsive layout.

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS
- **Animations**: Motion (Framer Motion)
- **Database**: Firebase Firestore (Remote) & Dexie.js (Local)
- **Authentication**: Firebase Anonymous Auth
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js (v20 or higher)
- Firebase Project

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd Shared-Shopping-List
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Create a `.env` file in the root directory and add your Firebase credentials:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

## Deployment

The project is configured for automated deployment via GitHub Actions to an FTP server. Ensure you have the following secrets configured in your GitHub repository:

- `FTP_SERVER`
- `FTP_USERNAME`
- `FTP_PASSWORD`
- `FTP_REMOTE_ROOT`
