# FishLERS
Fisheries Laboratory Equipment Reservation System

Project by: Bretaña, Buerom, Contreras, Verde

CMSC 129

## Project Overview
FishLERS is a laboratory management system designed to streamline the tracking, management, and utilization of laboratory equipment and resources. The system primarily serves laboratory staff, researchers, and students by providing a centralized platform to monitor inventory, schedule equipment usage, and maintain records of lab activities.

## Logical View Diagram

<img width="1920" height="1080" alt="User (studentfaculty)" src="https://github.com/user-attachments/assets/aa8ff28b-d952-41b3-990f-7f7b3357aaff" />


**Main Components of the System**
- User
  	- represents individuals who interact with the system.
  	- Behavior:
  	  - Submit reservation requests
  	  - View request status
  	  - View accountabilities
  	 
- Equipment
  	- represents available laboratory equipment for reservation.
  	- Behavior:
  	  - It can be added, edited, or deleted by the admin.
  	  - It can be reserved by the user by requesting.
  	  - The admin updates an equipment's availability status.
  	  - The condition of the equipment is being tracked.
  	 
- Request
  	- represents a request made by a user to reserve equipment. 
  	- Behavior:
  	  - It links a user to amn equipment.
  	  - Updates its status based on the admin's approval.

- Admin
  	- A type of user with administrative privileges.
  	- Behavior:
  	  - Approve or reject reservation requests
  	  - Manage equipment inventory
  	  - Handle accountability of users by checking the condition of the returned equipment

- Accountability
  	- Tracks responsibility for the borrowed equipment
  	- Behavior:
  	  - Records adjustments
  	  - Maintains history for auditing

**Relationships Between Components**

The system components interact through the following relationships:
1. User requests for an Equipment
2. User can track the status of their Request
3. Admin approves or declines the Requests of users
4. Admin manages the Equipment
5. Admin oversees and adjusts the Accountability
6. Accountability tracks Equipment usage by Users

## Software Architecture

The current system resembles the **Client-Side MVC Hybrid with a Monolithic Layered Frontend Architecture**. Although the system was intended to follow the MVC principles, it does not strictly implement a formal MVC structure but rather a loosely applied MVC pattern where responsibilities overlap across layers. 

On the client side, the system reflects characteristics of the MVC pattern, where:
- The view is represented by React components that render the user interface and manage user interactions,
- The controller logic exists within the same React components through event handling, hooks such as UseEffect, and API calls, and
- The model is partially represented through state management and data retrieved from the backend using Firebase via the backend API.
React components handle rendering, state management, and API communication within the same files, the separation between view and controller is not strictly enforced, making the architecture a hybrid MVC rather than purely MVC.


The frontend allows a monolithic layered architecture, where all presentation, business, and API interaction logic are contained within a single React application, where:
- The presentation layer is within React UI components and JSX,
- The application logic layer is within hooks, event handlers, and business rules,
- The data access layer is within API calls to the Express backend, and
- The data layer is within the Firebase database accessed through the backend

On the server side, Express and Node function as a unified backend service, handling routing, business logic, and communication with Firebase. This backend is deployed as a single service rather than multiple independent services, making it a monolithic backend.


Equipment records retrieved from Firebase act as the model, React components display equipment availability and status as the view, and event handlers manage actions such as adding, updating, or borrowing equipment as controller logic.

## Project Structure

**Current Project Structure** 

```text
fishlers/
├─ public/
│  ├─ fish.svg
│  └─ vite.svg
│
├─ scripts/
│  ├─ set-claim.cjs
│  └─ set-claim.js
│
├─ src/
│  ├─ assets/
│
│  ├─ components/                      (UI Components)
│  │  ├─ AdminDrawerLayout.tsx
│  │  ├─ DrawerLayout.tsx
│  │  ├─ NavBar.tsx
│  │  ├─ TopNavBar.tsx
│  │  ├─ ProtectedRoute.tsx
│  │  ├─ LoadingOverlay.tsx
│  │  └─ ...
│
│  ├─ pages/                           (Application Screens)
│  │  ├─ admin/
│  │  ├─ accountabilities/
│  │  ├─ equipment/
│  │  │  ├─ AddEquipmentDialog.tsx
│  │  │  ├─ EditEquipmentDialog.tsx
│  │  │  ├─ EquipmentList.tsx
│  │  │  ├─ EquipmentTable.tsx
│  │  │  ├─ Dashboard.tsx
│  │  │  ├─ logicEquipment.ts
│  │  │  └─ query.ts
│  │  ├─ requestform/
│  │  ├─ tracking/
│  │  ├─ LandingPage.tsx
│  │  ├─ Login.tsx
│  │  ├─ Signup.tsx
│  │  ├─ home-admin.tsx
│  │  ├─ home-student.tsx
│  │  ├─ profile-admin.tsx
│  │  └─ profile-student.tsx
│
│  ├─ context/
│  │  └─ ThemeContext.tsx
│
│  ├─ hooks/
│  │  └─ useAuth.tsx
│
│  ├─ lib/
│  │  └─ converter.tsx
│
│  ├─ firebase.tsx                     (Firebase Client SDK)
│  ├─ db.ts                            (Firestore Configuration)
│  ├─ admin.ts
│  ├─ App.tsx
│  ├─ main.tsx
│  └─ index.css
│
├─ firebase.json
├─ firestore.rules
├─ index.html
├─ package.json
├─ tailwind.config.js
├─ tsconfig.json
└─ vite.config.ts
```

The current project structure follows a single-application setup built using Vite, React, and Firebase. All major concerns including user interface components, routing, business logic, and database access are contained within one client-side codebase. The src/pages and src/components directories manage presentation layer, while logic related to authentication, equipment management, and request handling is embedded within page-level files and supporting utility modules such as logicEquipment.ts, query.ts, firebase.tsx, and db.ts. Firebase is accessed directly from the React application through the client SDK, and administrative functionality such as custom claims is handled via standalone scripts.

Although the project is functional, its structure does not strictly follow a formal architectural pattern such as Model-View-Controller (MVC). Instead, it reflects a loosely organized, feature-based client structure where data access, business rules, and UI logic are interwoven. This approach is common in early-stage development but becomes problematic as system complexity increases.

**Limitations of the Current Structure**

The primary issue with the current structure is the absence of clear separation of concerns. The View layer (React components and pages) directly interacts with Firebase for data retrieval and manipulation. As a result, database queries, validation rules, and business logic are embedded within UI-related files. This creates tight coupling between the presentation layer and the data layer.

Such coupling introduces several structural risks:
- Reduced maintainability, as changes to business rules require modifications in UI components.
- Increased security exposure, since database operations are triggered directly from the    client.
- Limited scalability, because adding new features may require duplicating logic across multiple pages.
- Reduced testability, as logic cannot be easily isolated from presentation concerns.
	
Furthermore, without a dedicated Controller layer, there is no centralized entry point for request handling. All data flow originates from the client, which makes it difficult to enforce consistent validation, authorization, and error handling.
	
For these reasons, refactoring toward a formal MVC architecture is necessary.

**Proposed Refactored Project Structure (FERN-MVC)**

```text
cmsc129-final-project/
│
├─ client/                                   (VIEW LAYER – React)
│  ├─ public/
│  ├─ src/
│  │  ├─ assets/
│  │
│  │  ├─ components/                         (Reusable UI Components)
│  │  ├─ pages/                              (Application Screens)
│  │  ├─ context/                            (UI State Management)
│  │  ├─ hooks/                              (Client Hooks)
│  │  ├─ api/                                (API Call Wrappers)
│  │  │  ├─ http.ts
│  │  │  ├─ auth.api.ts
│  │  │  ├─ equipment.api.ts
│  │  │  └─ requests.api.ts
│  │  │
│  │  ├─ App.tsx
│  │  ├─ main.tsx
│  │  └─ index.css
│  │
│  ├─ package.json
│  └─ vite.config.ts
│
├─ server/                                   (CONTROLLER + MODEL LAYERS – Express)
│  ├─ src/
│  │  ├─ app.ts                               (Express App Initialization)
│  │
│  │  ├─ routes/                              (Controller Routing Layer)
│  │  │  ├─ auth.routes.ts
│  │  │  ├─ equipment.routes.ts
│  │  │  └─ requests.routes.ts
│  │
│  │  ├─ controllers/                         (Controller Logic)
│  │  │  ├─ auth.controller.ts
│  │  │  ├─ equipment.controller.ts
│  │  │  └─ requests.controller.ts
│  │
│  │  ├─ services/                            (Model – Business Logic)
│  │  │  ├─ auth.service.ts
│  │  │  ├─ equipment.service.ts
│  │  │  └─ requests.service.ts
│  │
│  │  ├─ models/                              (Domain Models)
│  │  │  ├─ equipment.model.ts
│  │  │  ├─ request.model.ts
│  │  │  └─ user.model.ts
│  │
│  │  ├─ repositories/                        (Data Access Layer)
│  │  │  ├─ equipment.repo.ts
│  │  │  ├─ requests.repo.ts
│  │  │  └─ users.repo.ts
│  │
│  │  ├─ config/
│  │  │  ├─ env.ts
│  │  │  └─ firebaseAdmin.ts
│  │
│  │  └─ middleware/
│  │     ├─ requireAuth.ts
│  │     └─ errorHandler.ts
│  │
│  ├─ package.json
│  └─ tsconfig.json
│
├─ firebase/
│  ├─ firebase.json
│  ├─ firestore.rules
│  └─ scripts/
│
├─ .env
└─ README.md
```

The refactored architecture adopts a proper FERN stack structure with a clear separation between client and server. The project will be divided into two primary applications: a React client (View layer) and an Express server (Controller and Model layers), with Firebased functioning as the database layer accessed only through the server.
	
The refactored structure introduces the following conceptual separation:
1. View Layer (Client – React):
Responsible strictly for rendering UI components and collecting user input. Pages, layouts, and reusable components remain within the client directory. The client communicates with the server exclusively through REST API calls.

2. Controller Layer (Server – Express Routes and Controllers):
Routes define API endpoints, while controllers handle incoming HTTP requests and delegate logic to the service layer. This centralizes request processing and ensures consistent validation and response formatting.
        
3. Model Layer (Server – Services and Models):
Business logic and domain rules are isolated within service files. Domain representations (e.g., Equipment, Request, User) are formalized in model definitions. This ensures that rules such as approval workflows, role validation, and state transitions are independent of the UI.

4. Repository/Data Access Layer (Server – Firebase Admin):
All Firestore queries and authentication verification are moved into repository modules that use firebase-admin. The client no longer interacts directly with Firebase for privileged operations.

**Changes in the Refactoring**

The most significant structural change is the removal of direct database access from the client. Previously, files such as firebase.tsx, db.ts, and logic modules executed Firestore operations within React components. After refactoring, those responsibilities are relocated to the server-side repository layer.
	
Business logic that was embedded in UI-related files has been extracted into service modules. This ensures that the View layer no longer contains rule-based decisions such as approval conditions or status transitions.
	
Additionally, an explicit Controller layer has been introduced through Express routes and controller files. Instead of the client manipulating the database directly, it now sends structured HTTP requests to defined API endpoints. These endpoints act as controlled gateways into the system.
	
Finally, the overall project has transitioned from a single-layer client-centric structure to a layered, distributed architecture consistent with the FERN-MVC pattern. This transformation improves maintainability, enforces separation of concerns, enhances security, and increases scalability.

**Conclusion**

The original project structure was functionally adequate but architecturally informal. Its lack of separation between presentation, business logic, and data access created tight coupling and long-term scalability concerns. The refactored FERN-MV structure introduces clear boundaries between layers, centralizes control logic within the server, and formalizes the Model abstraction. As a result, the system becomes more modular, secure, maintainable, and aligned with established software architecture principles. 
