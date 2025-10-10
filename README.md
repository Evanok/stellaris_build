# Stellaris Build Sharing

Community-driven web platform for sharing, discovering, and optimizing Stellaris empire builds.

---

## Concept

**Stellaris Build Sharing** is a community website where players can create, share, and explore optimized empire configurations for *Stellaris*.  
The goal is to help players experiment with different playstyles, theorycraft new combinations, and learn from others’ strategies.

---

## Authentication & User Accounts

- User registration and login system  
- Personal profile pages  
- View all builds created by a specific user  
- Basic user stats: number of builds, reputation, favorites, etc.

---

## Build Management

Users can create detailed build sheets with the following information:

- **Build name**
- **Civics** (empire civic traits)
- **Species traits**
- **Detailed description**
- **Required DLCs**
- **Creation and last update dates**
- **Tested Stellaris version/patch**
- **Tags & categories**:
  - Type: military, economic, diplomatic, roleplay
  - Playstyle: tall, wide, rush
  - Species archetype: humanoid, machine, hive mind, etc.

**Additional features:**

- Edit and update builds  
- Delete own builds  
- Tag system for filtering and organization

---

## Community Interaction

- Rating system (upvote/downvote or star rating)
- Comment threads for feedback and discussion
- Reporting system for outdated or inappropriate builds
- “Build of the Month” highlight based on community votes

---

## Search & Discovery

Advanced build search and filtering options:

- Text-based search by keywords  
- Filter by:
  - Average rating  
  - Number of views  
  - Creation/update date  
  - Tags & categories  
  - DLC compatibility  
  - Tested game version
- Sort results by relevance, rating, popularity, or date

---

## Statistics & Insights

- View counter per build  
- Number of favorites/likes  
- Leaderboards for most popular or top-rated builds  
- Player contribution statistics  

---

## Recommended Tech Stack

- **Frontend:** Next.js + TailwindCSS
- **Backend:** Next.js API routes or Node/Express
- **Database:** PostgreSQL + Prisma ORM
- **Authentication:** NextAuth.js
- **Deployment:** Vercel (frontend) + Supabase or Railway (database/backend)

---

## Getting Started

### Prerequisites

- Node.js (version 18 or higher)
- npm or yarn package manager

### Installation

```bash
# Install dependencies
npm install
```

### Running the Development Server

```bash
# Start the development server
npm run dev
```

The application will be available at `http://localhost:3000`

### Testing the Website

Once the development server is running:

1. Open your browser and navigate to `http://localhost:3000`
2. Test the build form and features
3. Check the console for any errors

### Stopping the Server

- Press `Ctrl + C` in the terminal where the server is running

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

---

## Future Ideas

- Import/export builds as JSON for easy sharing  
- Integration with Paradox Mods or Steam Workshop  
- Build comparison tools (stats, synergy analysis, etc.)  
- Automatic parsing of Stellaris data files for updated civics and traits
