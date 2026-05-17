# Phase 1: Repository Restructuring

## Overview

Phase 1 involved the foundational reorganization of the FishLERS repository to establish clear separation between the frontend application, backend infrastructure, and Firebase configuration. This phase did not implement new features or modify business logic; rather, it prepared the repository structure for the subsequent implementation of a proper FERN-MVC architecture.

**Status:** ✅ Completed  
**Scope:** Directory restructuring only  
**Impact:** Enables layered architecture development in Phases 2–4

---

## What Was the Problem?

### Original Monolithic Structure

The FishLERS project initially existed as a single, unified application:

```
fishlers/ (root)
├── src/
│   ├── pages/
│   ├── components/
│   ├── firebase.tsx           (Client Firebase initialization)
│   ├── db.ts                  (Firestore types)
│   └── ...
├── public/
├── scripts/
│   ├── set-claim.cjs          (Admin script)
│   └── set-claim.js
├── firebase.json              (Firebase config)
├── firestore.rules            (Firestore security rules)
├── package.json
├── vite.config.ts
├── index.html
└── ...
```

**Problems with this structure:**

1. **No clear separation of concerns** – Frontend code, Firebase configuration, and admin scripts mixed in the same directory
2. **Unclear deployment strategy** – Difficult to distinguish what runs on the client, what runs on the server, and what is infrastructure
3. **Frontend tightly coupled to Firebase** – Client-side code directly accessed the database, with no backend intermediary
4. **Difficult to add a backend** – Adding an Express server would require restructuring the entire project layout
5. **Monolithic dependencies** – Both frontend and backend dependencies (if any) would coexist, causing confusion

---

## What Was Done

### Directory Separation

The repository was reorganized into three distinct directories, each with a specific responsibility:

#### 1. `client/` – React Frontend

The React application was moved into the `client/` directory:

```
client/
├── src/
│   ├── pages/              (Application screens)
│   ├── components/         (Reusable UI components)
│   ├── hooks/              (React hooks)
│   ├── context/            (React context for state management)
│   ├── lib/                (Utility libraries)
│   ├── utils/              (Helper functions)
│   ├── firebase.tsx        (Client Firebase initialization)
│   ├── db.ts               (Firestore type definitions)
│   ├── admin.ts            (Admin utilities)
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/                 (Static assets)
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

**Responsibility:** Rendering the user interface, handling user interactions, and (initially) accessing Firebase for data.

**Rationale:** Isolating the frontend as a separate application makes it clear what code is client-side and allows it to run independently.

#### 2. `server/` – Express Backend (Created for Phase 2+)

A new `server/` directory was created to host the Express backend application:

```
server/
├── src/
│   ├── index.ts            (Entry point)
│   ├── app.ts              (Express setup)
│   ├── config/             (Configuration files)
│   ├── middleware/         (Middleware)
│   ├── routes/             (API route definitions)
│   ├── controllers/        (HTTP request handlers)
│   ├── services/           (Business logic)
│   ├── repositories/       (Data access layer)
│   └── models/             (Domain models)
├── package.json
├── tsconfig.json
└── .env.example
```

**Responsibility (Phase 2+):** Handle HTTP requests, enforce business rules, and manage all Firestore operations on behalf of the client.

**Rationale:** Creating this directory structure in advance provided a clear location for the backend implementation to follow.

#### 3. `firebase/` – Firebase Configuration

Firebase configuration files and scripts were moved into the `firebase/` directory:

```
firebase/
├── firebase.json           (Firebase project metadata)
├── firestore.rules         (Firestore security rules)
├── ADMIN_README.md         (Admin documentation)
└── scripts/
    ├── set-claim.cjs       (Admin script for setting custom claims)
    └── set-claim.js        (Admin script TypeScript version)
```

**Responsibility:** Storing Firebase project configuration, Firestore security rules, and administrative scripts for managing Firebase (e.g., setting custom claims for role-based access control).

**Rationale:** Separating Firebase infrastructure from application code makes it clear these assets are project configuration, not part of the application.

---

## Directory Structure After Phase 1

```
cmsc129-final-project/ (root)
│
├── client/                          (VIEW LAYER – React Frontend)
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── context/
│   │   ├── lib/
│   │   ├── utils/
│   │   ├── firebase.tsx
│   │   ├── db.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── index.html
│
├── server/                          (CONTROLLER + MODEL LAYERS – Express Backend)
│   ├── src/
│   │   ├── index.ts
│   │   ├── app.ts
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   └── models/
│   ├── package.json
│   └── tsconfig.json
│
├── firebase/                        (CONFIGURATION + SCRIPTS)
│   ├── firebase.json
│   ├── firestore.rules
│   ├── ADMIN_README.md
│   └── scripts/
│       ├── set-claim.cjs
│       └── set-claim.js
│
├── .git/
├── .gitignore
├── README.md
└── [documentation files for refactor]
```

---

## Why Was This Restructuring Necessary?

### 1. Architectural Clarity

By separating frontend, backend, and configuration into distinct directories, the role of each component became explicit:
- **`client/`** contains all user-facing logic
- **`server/`** contains all data processing and business rules
- **`firebase/`** contains infrastructure configuration

### 2. Enables FERN-MVC Pattern

The FERN-MVC architecture requires clear boundaries between:
- **View Layer** (React frontend in `client/`)
- **Controller + Model Layers** (Express backend in `server/`)  
- **Database** (Firestore, accessed only through the backend)

This separation makes implementing these layers straightforward in subsequent phases.

### 3. Dependency Management

With separate `package.json` files:
- **`client/package.json`** contains only frontend dependencies (React, Vite, Firebase client SDK)
- **`server/package.json`** contains only backend dependencies (Express, Firebase Admin SDK, Node.js utilities)

This prevents:
- Unnecessary bloat in the frontend bundle
- Confusion about which dependencies apply where
- Accidental use of server-only dependencies in the client

### 4. Independent Development and Deployment

Separating frontend and backend allows:
- **Different tech stacks** – Backend could use a different framework without affecting frontend
- **Independent deployment** – Client and server can be deployed separately on different hosting platforms
- **Parallel development** – Frontend and backend teams can work simultaneously
- **Isolated testing** – Each component can be tested independently

### 5. Preparation for Microservices

The structure created in Phase 1 makes it possible to evolve toward microservices in the future:
- Additional backend services could be added alongside `server/`
- Different services could have their own dependencies
- Services could be deployed independently

---

## What Changed in the Frontend

### No Logic Changes

The frontend application was moved into `client/` without any modifications to:
- React components
- Business logic
- Firebase initialization
- Firestore queries
- User interface behavior

The application continued to function identically after the move.

### Environment Configuration

The client continued to use its existing `.env` file structure, with variables for Firebase configuration:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### Frontend Continued to Run

The frontend application ran successfully from the `client/` directory:

```bash
cd client
npm install
npm run dev
# Application starts normally on http://localhost:5173
```

---

## What the Backend Directory Contained

The `server/` directory was created with an empty or minimal structure:

```
server/
├── package.json          (Skeleton, empty dependencies)
├── tsconfig.json         (TypeScript configuration template)
└── .env.example          (Configuration template)
```

No implementation code was added during Phase 1. The backend was implemented in **Phase 2** onwards.

---

## Impact on Running the Application

After Phase 1, the application worked exactly as before:

```bash
# Start the frontend
cd client
npm run dev
# Application runs on http://localhost:5173 and accesses Firebase directly
```

The restructuring was **non-breaking** – no changes to functionality, only directory organization.

---

## Preparation for Phase 2

Phase 1 created the foundation for Phase 2, which would:

1. **Fill the `server/` directory** with a proper Express application
2. **Add Firebase Admin SDK** configuration to the server
3. **Create routes, controllers, and services** for the backend
4. **Modify the client** to call the backend API instead of accessing Firebase directly

By establishing clear directory boundaries in Phase 1, Phase 2 could proceed without requiring additional restructuring.

---

## Files Modified During Phase 1

**Created:**
- `server/` directory with skeleton structure
- `firebase/` directory with infrastructure files

**Moved (no modifications):**
- Entire `client/src/` tree
- `client/public/`
- `client/package.json`
- `client/vite.config.ts`
- `client/tsconfig.json`
- `client/index.html`

**Moved into `firebase/`:**
- `firebase.json`
- `firestore.rules`
- `scripts/set-claim.cjs` and `set-claim.js`

---

## Key Principles Established in Phase 1

✅ **Separation of Concerns** – Frontend, backend, and configuration are physically separated  
✅ **Clear Responsibilities** – Each directory has a defined purpose  
✅ **Independent Deployment** – Client and server can be deployed separately  
✅ **Scalable Structure** – Easy to add new services or features in their own directories  
✅ **Non-Breaking Change** – Application functionality remained unchanged  

---

## Conclusion

Phase 1 was a critical preparatory step that reorganized the FishLERS project for proper architectural implementation. By separating the React frontend, Express backend, and Firebase configuration into distinct directories, the project became structured for implementation of the FERN-MVC pattern.

The restructuring was **non-invasive** – no business logic was altered, allowing the frontend to continue functioning while preparing the foundation for backend development in Phase 2.

With the repository properly organized, Phase 2 could begin implementation of the Express server with a clear understanding of where each component belonged and how they would interact.

---

**Next Phase:** [Phase 2 – Minimal Express Server Scaffold](IMPLEMENTATION_SUMMARY.md#phase-2-minimal-express-server-scaffold)
