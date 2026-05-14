# GrievAI Backend - API Documentation


## 🔐 1. Authentication APIs (`/api/auth`)
These endpoints manage user identities, including Citizens, Officers, and Senior Officers.

### `POST /api/auth/register`
- **Purpose:** Registers a new user (typically a Citizen) into the platform.
- **Working:** 
  - Receives user details (`name`, `mobileNo`, `email`, `password`).
  - Checks if the user already exists to prevent duplicates.
  - Securely hashes the password using `bcrypt`.
  - Creates the user in the database (defaulting to the `citizen` role).
  - Returns a JWT token for immediate login.

### `POST /api/auth/login`
- **Purpose:** Authenticates an existing user and establishes a session.
- **Working:** 
  - Validates `email` and `password`.
  - Compares the hashed password in the database.
  - Generates a JSON Web Token (JWT) containing the user's `id`, `role`, and `department` (if applicable).
  - Sets the token in an HTTP-only cookie for secure, persistent sessions.

### `GET /api/auth/me`
- **Purpose:** Verifies the user's active session on page reloads.
- **Working:** 
  - Protected by `authMiddleware`.
  - Reads the JWT from the cookies, decodes it, and retrieves the latest user profile from the database.
  - Allows the frontend to know exactly who is logged in without asking them to re-authenticate.

---

## 🏢 2. Department APIs (`/api/departments`)
These endpoints manage the internal departments (e.g., Water, Sanitation, Electricity) and the officers assigned to them. Many of these routes utilize Role-Based Access Control (RBAC).

### `GET /api/departments/`
- **Purpose:** Fetches a list of all active departments.
- **Access:** Public
- **Working:** Returns the complete directory of departments, their codes, and categories. Useful for populating dropdown menus on the frontend.

### `GET /api/departments/leaderboard`
- **Purpose:** Retrieves a ranked list of departments based on performance.
- **Access:** Protected (Senior Officers only)
- **Working:** Analyzes complaint resolution metrics and sorts departments by efficiency.

### `GET /api/departments/:code`
- **Purpose:** Fetches detailed information about a specific department.
- **Access:** Public
- **Working:** Uses the department's unique code (e.g., `MUNC`, `ELEC`) to return its specific SLA (Service Level Agreement) details and metadata.

### `GET /api/departments/:code/stats`
- **Purpose:** Provides analytical statistics for a specific department.
- **Access:** Protected (Senior Officers only)
- **Working:** Aggregates data to show Total Complaints, Resolved Complaints, Resolution Rate, and SLA Breaches for a department.

### `GET /api/departments/:code/officers`
- **Purpose:** Lists all staff assigned to a department.
- **Access:** Protected (Senior Officers only)
- **Working:** Populates and returns the profiles of all officers currently mapped to the given department's `officers` array.

### `POST /api/departments/:code/officers`
- **Purpose:** Assigns an existing officer to a department.
- **Access:** Protected (Senior Officers only)
- **Working:** 
  - Validates that the target user has the `officer` role.
  - If the officer is in another department, removes them from the old one.
  - Pushes their ID into the new department's `officers` array and updates their User document.

### `DELETE /api/departments/:code/officers/:officerId`
- **Purpose:** Unassigns an officer from a department.
- **Access:** Protected (Senior Officers only)
- **Working:** Removes the `officerId` from the department's array and nullifies the `department` field on the officer's User document.

---

## 🗄️ 3. Database Architecture & Seeding
To support a robust demo environment without exposing security risks:
- **Single Source of Truth:** Citizens, Officers, and Senior Officers all share the `User` collection, differentiated by a `role` field. This makes authentication uniform and straightforward.
- **Automated Seeding:** We implemented a `seedOfficers.js` script that dynamically generates **72 dummy officers** (12 per department) with realistic Indian names.
- **Load Balancing Prep:** We introduced an `activeComplaintsCount` field to the `User` model. This sets the foundation for our upcoming algorithm: when a citizen files a complaint, it will automatically be assigned to the officer in that department who has the lowest workload.
