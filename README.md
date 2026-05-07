# TaskFlow — Team Task Manager

A full-stack web application for managing teams, projects, and tasks with role-based access control.

## 🚀 Features

- **Authentication** — Signup/Login with JWT, role-based (Admin/Member)
- **Admin Workflow** — Create projects, add members, assign tasks, mark projects complete
- **Member Workflow** — View assigned tasks, update task status (Todo → In Progress → Review → Done)
- **Progress Tracking** — Live progress bars on every project showing % completion
- **Dashboard** — Stats overview + role-specific views (Admin sees all, Member sees their tasks)
- **Kanban Board** — Drag-free column view with quick status-change buttons per task
- **Overdue Detection** — Visual indicators for past-deadline tasks

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router v6, Axios, react-hot-toast |
| Backend | Node.js, Express.js |
| Database | MongoDB + Mongoose |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Deployment | Railway |

## 👤 How the Admin → Member Workflow Works

### Admin:
1. Sign up and select **Admin** role
2. Go to **Projects** → click **+ New Project**
3. Inside project → click **👥 Manage Members** → add Members
4. Create tasks, assign them to Members with priority + deadline
5. Monitor progress bar on each project
6. When all work is done → click **✓ Mark Complete**

### Member:
1. Sign up and select **Member** role
2. Dashboard shows assigned tasks automatically
3. Open any project they've been added to
4. Update task status: **Todo → In Progress → Review → Done**
5. Use quick status buttons on Kanban cards

## 📁 Project Structure

```
team-task-manager/
├── backend/
│   ├── models/         # User, Project, Task
│   ├── routes/         # auth, projects, tasks, users
│   ├── middleware/     # JWT auth + adminOnly
│   └── server.js
├── frontend/
│   └── src/
│       ├── pages/      # Dashboard, Projects, ProjectDetail, Tasks, Users, Login, Signup
│       ├── components/ # Layout
│       ├── context/    # AuthContext
│       └── utils/      # api.js (Axios)
└── README.md
```

## ⚙️ Setup Locally

### Backend
```bash
cd backend
cp .env.example .env
# Fill in MONGO_URI and JWT_SECRET
npm install
npm run dev
```

### Frontend
```bash
cd frontend
cp .env.example .env
# Set REACT_APP_API_URL=http://localhost:5000/api
npm install
npm start
```

## 🌐 Deploy on Railway

### Backend Service
- Deploy `backend/` folder from GitHub
- Environment variables:
  - `MONGO_URI` — MongoDB Atlas connection string
  - `JWT_SECRET` — any random secret
  - `FRONTEND_URL` — your frontend Railway URL
  - `PORT` — 5000

### Frontend Service
- Deploy `frontend/` folder from GitHub
- Environment variable:
  - `REACT_APP_API_URL` — your backend Railway URL + `/api`

## 🔑 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register (name, email, password, role) |
| POST | `/api/auth/login` | Login — returns JWT |
| GET | `/api/auth/me` | Get current user |

### Projects
| Method | Endpoint | Access |
|--------|----------|--------|
| GET | `/api/projects` | Any member |
| POST | `/api/projects` | Admin only |
| PUT | `/api/projects/:id` | Owner/Admin (mark Complete here) |
| DELETE | `/api/projects/:id` | Owner/Admin |
| POST | `/api/projects/:id/members` | Owner/Admin |
| DELETE | `/api/projects/:id/members/:userId` | Owner/Admin |

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List with filters |
| GET | `/api/tasks/dashboard` | Stats |
| POST | `/api/tasks` | Create (project member) |
| PUT | `/api/tasks/:id` | Update status etc |
| DELETE | `/api/tasks/:id` | Creator or Admin |
| POST | `/api/tasks/:id/comments` | Add comment |

## 👥 Roles

| Feature | Admin | Member |
|---------|-------|--------|
| Create projects | ✅ | ❌ |
| Add/remove members | ✅ | ❌ |
| Mark project complete | ✅ | ❌ |
| Create tasks | ✅ | ✅ (in their projects) |
| Update task status | ✅ | ✅ |
| Delete any task | ✅ | ❌ |
| Delete own task | ✅ | ✅ |
| Manage users | ✅ | ❌ |

## 📦 Submission Checklist
- [ ] Live URL (Railway)
- [ ] GitHub repository
- [ ] README (this file)
- [ ] 2–5 min demo video
