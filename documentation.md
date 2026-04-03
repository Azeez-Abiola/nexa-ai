# UACN GPT - Complete Project Documentation

**Last Updated:** March 30, 2026  
**Project Status:** Production-Ready for Handover  
**Version:** 1.0.0

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Business Units Configuration](#business-units-configuration)
6. [Database Models](#database-models)
7. [API Documentation](#api-documentation)
8. [Frontend Components](#frontend-components)
9. [Environment Variables](#environment-variables)
10. [Setup & Installation](#setup--installation)
11. [Development Workflow](#development-workflow)
12. [Deployment Guide](#deployment-guide)
13. [Key Features](#key-features)
14. [Authentication Flow](#authentication-flow)
15. [Common Issues & Troubleshooting](#common-issues--troubleshooting)
16. [Future Enhancements](#future-enhancements)

---

## Project Overview

### What is UACN GPT?

UACN GPT is an **internal ChatGPT-style AI assistant** designed for employees of UACN (Union African Capital Network) and its subsidiaries. It serves as an intelligent policy advisor and general knowledge assistant.

### Key Purpose

- **Policy Intelligence**: Provides quick answers about company policies specific to each business unit
- **Multi-Tenant Support**: Serves 7 different subsidiaries with separate, isolated policy systems
- **Employee Self-Service**: Reduces HR burden by enabling employees to query policies directly
- **Admin Management**: Allows administrators to upload and manage policies for their respective business units

### Core Functionalities

1. **User Registration & Authentication** - Email verification, JWT tokens
2. **Policy Management** - Upload, organize, and search company policies (PDF, DOCX, TXT)
3. **AI Chat Interface** - Conversational interface with OpenAI models
4. **Admin Dashboard** - Manage policies, view analytics, control access
5. **Conversation Export** - Export chat histories as PDF or DOCX
6. **Email Notifications** - Verification emails, password resets via Resend

---

## Architecture

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                   │
│  - Landing Page  - User Chat Interface  - Admin Dashboard    │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP(S)
┌──────────────────────────▼──────────────────────────────────┐
│                 Backend (Express.js)                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Routes:                                              │   │
│  │  - POST /api/auth/register, /login, /verify-email   │   │
│  │  - POST /api/admin/auth/* (Admin Auth)              │   │
│  │  - POST /api/chat (AI Responses)                    │   │
│  │  - GET/POST /api/conversations/* (Chat History)     │   │
│  │  - GET/POST /api/admin/policies/* (Policy Mgmt)     │   │
│  │  - GET /api/analytics (Dashboard Data)              │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Services:                                            │   │
│  │  - Email Service (Resend)                           │   │
│  │  - OpenAI Service (GPT Models)                       │   │
│  │  - Google Search Service (SerpAPI)                  │   │
│  │  - Document Parsers (PDF, DOCX)                     │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼──────┐  ┌────────▼───────┐  ┌─────▼──────────┐
│  MongoDB     │  │  OpenAI API    │  │  SerpAPI       │
│  Database    │  │  (Conversations)  │  (Search)       │
└──────────────┘  └────────────────┘  └────────────────┘
                │
         ┌──────▼────────┐
         │  Resend       │
         │  Email API    │
         └───────────────┘
```

### Data Flow

**New User Registration:**
1. User submits registration form
2. Backend validates email domain (business unit match)
3. Email verification OTP sent via Resend
4. User enters OTP to verify email
5. User account activated, JWT token issued

**Chat Interaction:**
1. User sends message
2. Backend detects intent (greeting, policy question, etc.)
3. Retrieves relevant policies from MongoDB
4. Constructs system prompt with context
5. Calls OpenAI API with conversation history
6. Stores message and response in Conversation model
7. Returns formatted response to frontend

**Policy Upload (Admin):**
1. Admin uploads PDF/DOCX file
2. Text extracted and parsed
3. Policy document stored in MongoDB
4. Indexed by business unit and category
5. Available for search and context injection

---

## Technology Stack

### Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20+ | Runtime environment |
| Express.js | 4.21.2 | Web framework |
| TypeScript | 5.6.3 | Language & type safety |
| MongoDB | 8.6.0 (Mongoose) | Database |
| OpenAI | 6.22.0 | AI/LLM integration |
| Resend | 6.9.3 | Email service |
| JWT | 9.0.0 | Authentication tokens |
| bc ryptjs | 2.4.3 | Password hashing |
| Multer | 1.4.5 | File upload handling |
| PDF-Parse | 1.1.1 | PDF extraction |
| Mammoth | 1.6.0 | DOCX extraction |

### Frontend

| Technology | Purpose |
|-----------|---------|
| React | UI library |
| TypeScript | Type safety |
| Vite | Build tool & dev server |
| Tailwind CSS | Styling |
| Radix UI | Component library |
| Axios | HTTP client |
| React Router | Routing |
| React Icons | Icons |
| Framer Motion | Animations |
| date-fns | Date utilities |

### Infrastructure & Services

- **Database**: MongoDB (self-hosted or Atlas)
- **Email**: Resend (https://resend.com)
- **AI Model**: OpenAI (GPT-4o-mini or GPT-4)
- **Search**: SerpAPI (optional, for Google search integration)

---

## Project Structure

```
UACN-GPT/
├── backend/
│   ├── src/
│   │   ├── index.ts                 # Express app entry point
│   │   ├── config/
│   │   │   └── businessUnits.ts     # BU configuration & metadata
│   │   ├── middleware/
│   │   │   └── auth.ts              # JWT validation middleware
│   │   ├── models/                  # Mongoose schemas
│   │   │   ├── User.ts              # Regular user schema
│   │   │   ├── AdminUser.ts         # Admin user schema
│   │   │   ├── Conversation.ts      # Chat history storage
│   │   │   ├── Policy.ts            # Company policies
│   │   │   ├── BusinessUnit.ts      # BU metadata
│   │   │   └── BusinessUnitEmailMapping.ts
│   │   ├── routes/                  # Express route handlers
│   │   │   ├── auth.ts              # User authentication
│   │   │   ├── adminAuth.ts         # Admin authentication
│   │   │   ├── chat.ts              # Chat/AI endpoints
│   │   │   ├── conversation.ts      # Chat history
│   │   │   ├── adminPolicies.ts     # Policy management
│   │   │   └── analytics.ts         # Analytics data
│   │   ├── services/                # Business logic
│   │   │   ├── emailService.ts      # Resend email handling
│   │   │   ├── openaiService.ts     # OpenAI integration
│   │   │   └── googleSearchService.ts # SerpAPI integration
│   │   ├── utils/                   # Utilities
│   │   │   ├── pdfParser.ts         # PDF text extraction
│   │   │   └── docxParser.ts        # DOCX text extraction
│   │   ├── types/
│   │   │   └── pdf-parse.d.ts       # Type definitions
│   │   └── .env                     # Environment variables
│   ├── package.json
│   ├── tsconfig.json
│   └── dist/                        # Compiled JavaScript

├── frontend/
│   ├── src/
│   │   ├── main.tsx                 # React entry point
│   │   ├── App.tsx                  # Main router component
│   │   ├── Admin.tsx                # Admin page wrapper
│   │   ├── AdminHome.tsx            # Admin dashboard
│   │   ├── AdminLogin.tsx           # Admin login page
│   │   ├── Home.tsx                 # User home/chat page
│   │   ├── Login.tsx                # User login page
│   │   ├── chat/                    # Chat components
│   │   │   ├── ChatBot.tsx          # Main chat interface
│   │   │   ├── ChatBotInput.tsx     # Message input
│   │   │   ├── ChatBotMessageList.tsx
│   │   │   ├── ChatMessage.tsx      # Individual message
│   │   │   └── ...other chat components
│   │   ├── landing/                 # Landing page components
│   │   │   ├── HeroSection.tsx
│   │   │   ├── FeaturesSection.tsx
│   │   │   └── ...other landing sections
│   │   ├── components/              # Reusable components
│   │   │   ├── PrivacyPolicy.tsx
│   │   │   ├── FAQSection.tsx
│   │   │   └── ...other components
│   │   ├── utils/                   # Frontend utilities
│   │   │   ├── chatExport.ts        # Export to PDF/DOCX
│   │   │   └── parseMarkdown.ts     # Markdown parsing
│   │   ├── lib/                     # Libraries & helpers
│   │   ├── styles/                  # Global styles
│   │   └── vite-env.d.ts
│   ├── public/
│   │   └── c-panel.html             # Admin control panel (legacy)
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── tsconfig.json

├── Landing page/                    # Separate landing page project
├── public/                          # Public assets
├── package.json                     # Root workspace config
├── README.md
├── RESEND_INTEGRATION_GUIDE.md
├── RESEND_QUICK_START.md
└── FRONTEND_IMPLEMENTATION_GUIDE.md
```

---

## Business Units Configuration

UACN GPT serves 7 business units (subsidiaries). Each has:
- Unique abbreviation (2-3 letters)
- Full legal name
- Separate policy database
- Dedicated admin users (optional)
- Email domain mapping

### Supported Business Units

| Abbreviation | Full Name | Industry | Email Domain |
|---|---|---|---|
| **GCL** | Grand Cereals Limited | Food & Beverages | (configured in DB) |
| **LSF** | Livestocks Feeds Limited | Agriculture & Feeds | (configured in DB) |
| **CAP** | Chemical and Allied Products PLC | Chemicals & Paints | (configured in DB) |
| **UFL** | UAC Foods Limited | Food & Beverages | (configured in DB) |
| **CHI** | Chivita\|Hollandia Limited | Food & Beverages | (configured in DB) |
| **UAC-Restaurants** | UAC Restaurants | Food & Beverages | (configured in DB) |
| **UPDC** | UPDC Real Estate Investment Trust | Real Estate | (configured in DB) |

### Configuration File: `backend/src/config/businessUnits.ts`

Contains:
- Display names and labels for each BU
- Industry classification
- Description text
- Full name formats

**Important**: When modifying BDs, update:
1. `businessUnits.ts` configuration file
2. User schema enum (backend/src/models/User.ts)
3. AdminUser schema enum (backend/src/models/AdminUser.ts)
4. Frontend business unit dropdown lists

---

## Database Models

### 1. User Model (`User.ts`)

Standard user account for chat access.

```typescript
{
  _id: ObjectId,
  email: string (unique, lowercase),
  fullName: string,
  businessUnit: "GCL" | "LSF" | "CAP" | "UFL" | "CHI" | "UAC-Restaurants" | "UPDC",
  password: string (hashed with bcryptjs),
  emailVerified: boolean (default: false),
  emailVerificationOTP?: string,
  emailVerificationOTPExpiry?: Date,
  resetToken?: string (for password reset),
  resetTokenExpiry?: Date,
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

**Validations:**
- Email must be unique and lowercase
- Business unit must match predefined enum
- Email domain must match business unit settings (if configured)
- Password minimum 6 characters

**Indexes:**
- `email` (unique)
- `businessUnit` (for filtering)

---

### 2. AdminUser Model (`AdminUser.ts`)

Admin account with policy management permissions.

```typescript
{
  _id: ObjectId,
  email: string (unique, lowercase),
  fullName: string,
  businessUnit: "GCL" | "LSF" | "CAP" | "UFL" | "CHI" | "UAC-Restaurants" | "UPDC" | "SUPERADMIN",
  password: string (hashed),
  emailVerified: boolean,
  emailVerificationOTP?: string,
  emailVerificationOTPExpiry?: Date,
  resetToken?: string,
  resetTokenExpiry?: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**Special Case:**
- **SUPERADMIN**: Super admin account with access to all business units (e.g., C-Panel)
- Regular admins: Limited to their business unit

---

### 3. Conversation Model (`Conversation.ts`)

Stores chat history for users, organized by conversation groups.

```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  conversationGroups: [
    {
      _id: ObjectId,
      title: string (default: "New Chat"),
      messages: [
        {
          role: "user" | "assistant",
          content: string,
          timestamp: Date
        }
      ],
      createdAt: Date,
      updatedAt: Date
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

**Structure:**
- One conversation document per user (`userId` unique index)
- Multiple conversation groups within
- Multiple messages per conversation group

**Use Cases:**
- Load all conversations for a user
- Search messages within conversations
- Export specific conversations

---

### 4. Policy Model (`Policy.ts`)

Stores parsed company policy documents.

```typescript
{
  _id: ObjectId,
  title: string,
  category: string,
  content: string (full text after parsing),
  tags: [string],
  businessUnit: string,
  uploadedBy: {
    adminId: string,
    adminEmail: string,
    adminName?: string
  },
  sourceFile: {
    filename: string,
    fileType: "text" | "docx" | "pdf",
    uploadedAt: Date
  },
  createdAt: Date,
  updatedAt: Date
}
```

**Categories** (flexible list):
- HR Policies
- Leave & Attendance
- Code of Conduct
- Benefits
- Work Hours
- Remote Work
- Training & Development
- etc.

**Indexes:**
- `businessUnit` (for querying BU policies)
- Categories and tags for searching

---

### 5. BusinessUnit Model (`BusinessUnit.ts`)

Configuration and metadata for business units.

```typescript
{
  _id: ObjectId,
  name: string (e.g., "GCL"),
  label: string (full display name),
  industry: string,
  description: string,
  settings?: {
    // Future expansion for BU-specific settings
  }
}
```

---

### 6. BusinessUnitEmailMapping Model

Maps business units to allowed email domains.

```typescript
{
  _id: ObjectId,
  businessUnit: string,
  emailDomain: string (e.g., "@gcl.com.ng"),
  createdAt: Date,
  updatedAt: Date
}
```

**Purpose**: Validate that users registering for a BU have company email.

---

## API Documentation

### Base URL
- **Development**: `http://localhost:5000`
- **Production**: `https://your-domain.com`

### Authentication

All protected routes require JWT token in header:
```
Authorization: Bearer <jwt_token>
```

---

### User Authentication Routes

#### 1. Register User
```
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@gcl.com.ng",
  "password": "securePassword123",
  "fullName": "John Doe",
  "businessUnit": "GCL"
}

Response 201:
{
  "message": "User registered successfully. Check your email for verification OTP.",
  "userId": "mongo_id"
}

Response 400:
{
  "error": "Email must end with @gcl.com.ng for GCL"
}
```

#### 2. Verify Email OTP
```
POST /api/auth/verify-email
Content-Type: application/json

{
  "email": "user@gcl.com.ng",
  "otp": "123456"
}

Response 200:
{
  "message": "Email verified successfully"
}
```

#### 3. Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@gcl.com.ng",
  "password": "securePassword123"
}

Response 200:
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "mongo_id",
    "email": "user@gcl.com.ng",
    "fullName": "John Doe",
    "businessUnit": "GCL"
  }
}

Response 401:
{
  "error": "Invalid email or password"
}
```

#### 4. Forgot Password
```
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "user@gcl.com.ng"
}

Response 200:
{
  "message": "Password reset link sent to email"
}
```

#### 5. Reset Password
```
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "reset_token_from_email",
  "email": "user@gcl.com.ng",
  "newPassword": "newPassword456"
}

Response 200:
{
  "message": "Password reset successfully"
}
```

#### 6. Resend Verification Email
```
POST /api/auth/resend-verification-email
Content-Type: application/json

{
  "email": "user@gcl.com.ng"
}

Response 200:
{
  "message": "Verification email sent"
}
```

---

### Admin Authentication Routes

#### 1. Admin Register
```
POST /api/admin/auth/register
Content-Type: application/json

{
  "email": "admin@gcl.com.ng",
  "password": "securePassword123",
  "fullName": "Admin User",
  "businessUnit": "GCL"
}

Response 201: { "message": "Admin registered...", "adminId": "..." }
```

#### 2. Admin Login
```
POST /api/admin/auth/login

{
  "email": "admin@gcl.com.ng",
  "password": "securePassword123"
}

Response 200:
{
  "token": "admin_jwt_token",
  "admin": {
    "adminId": "mongo_id",
    "email": "admin@gcl.com.ng",
    "fullName": "Admin User",
    "businessUnit": "GCL"
  }
}
```

---

### Chat Routes

#### 1. Send Chat Message
```
POST /api/chat
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "businessUnit": "GCL",
  "message": "What is the leave policy?"
}

Response 200:
{
  "response": "According to GCL's leave policy...",
  "conversationId": "mongo_id",
  "messageId": "mongo_id"
}
```

---

### Conversation Routes

#### 1. Get All Conversations
```
GET /api/conversations
Authorization: Bearer <user_token>

Response 200:
{
  "conversations": [
    {
      "_id": "mongo_id",
      "title": "Leave Policy Discussion",
      "messages": [...],
      "createdAt": "2024-01-15T..."
    }
  ]
}
```

#### 2. Get Specific Conversation
```
GET /api/conversations/:conversationId
Authorization: Bearer <user_token>

Response 200: { conversation object with full message history }
```

#### 3. Update Conversation Title
```
PUT /api/conversations/:conversationId
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "title": "New title"
}

Response 200: { "message": "Conversation updated" }
```

#### 4. Delete Conversation
```
DELETE /api/conversations/:conversationId
Authorization: Bearer <user_token>

Response 200: { "message": "Conversation deleted" }
```

#### 5. Create New Conversation
```
POST /api/conversations
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "title": "New Chat"
}

Response 201: { conversationId, title, messages[] }
```

---

### Admin Policy Routes

#### 1. Upload Policy (Admin Only)
```
POST /api/admin/policies/upload
Authorization: Bearer <admin_token>
Content-Type: multipart/form-data

Form Fields:
- file: (PDF, DOCX, or TXT file)
- title: "Leave Policy"
- category: "HR Policies"
- tags: "leave,vacation,time-off"

Response 201:
{
  "_id": "mongo_id",
  "title": "Leave Policy",
  "category": "HR Policies",
  "businessUnit": "GCL",
  "uploadedBy": {
    "adminId": "...",
    "adminEmail": "admin@gcl.com.ng"
  }
}
```

#### 2. Get Policies for Business Unit
```
GET /api/admin/policies?businessUnit=GCL
Authorization: Bearer <admin_token>

Response 200:
{
  "policies": [
    {
      "_id": "...",
      "title": "...",
      "category": "...",
      "tags": [],
      "uploadedBy": {...},
      "createdAt": "..."
    }
  ],
  "total": 5
}
```

#### 3. Delete Policy (Admin Only)
```
DELETE /api/admin/policies/:policyId
Authorization: Bearer <admin_token>

Response 200: { "message": "Policy deleted" }
```

#### 4. Update Policy (Admin Only)
```
PUT /api/admin/policies/:policyId
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "title": "Updated Title",
  "category": "HR Policies",
  "tags": ["leave", "vacation"]
}

Response 200: { updated policy object }
```

---

### Analytics Routes

#### 1. Get Analytics Dashboard Data
```
GET /api/analytics?startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <admin_token>

Response 200:
{
  "totalUsers": 145,
  "totalConversations": 892,
  "totalMessages": 5432,
  "activeUsers": 89,
  "policiesUploaded": 52,
  "topQuestions": [...],
  "userGrowth": [...]
}
```

---

### Public Routes (No Auth Required)

#### 1. Get Business Units
```
GET /api/public/business-units

Response 200:
{
  "businessUnits": [
    {
      "value": "GCL",
      "label": "Grand Cereals Limited (GCL)",
      "name": "GCL"
    },
    ...
  ]
}
```

#### 2. Health Check
```
GET /health

Response 200:
{
  "status": "ok"
}
```

---

## Frontend Components

### Main Components Structure

#### **App.tsx**
- Root component with routing logic
- Manages authentication state
- Initializes from localStorage
- Renders Landing Page, Chat Interface, or Admin Dashboard

#### **Login.tsx**
- User login form
- Email/password fields
- Error handling
- Redirects to home on success
- Link to registration

#### **AdminLogin.tsx**
- Admin login form
- Similar to user login
- Creates admin session
- Redirects to admin dashboard

#### **Home.tsx**
- Main user chat interface
- Integrates ChatBot component
- Displays conversation history
- Sidebar with conversation list

#### **AdminHome.tsx**
- Admin dashboard
- Policy upload interface
- Analytics display
- User management (if implemented)
- Policy listing and management

#### **Chat Components** (`chat/` folder)

1. **ChatBot.tsx** - Main chat container
2. **ChatBotInput.tsx** - Message input field
3. **ChatBotMessageList.tsx** - Message history display
4. **ChatMessage.tsx** - Individual message component
5. **TypingIndicator.tsx** - Loading animation
6. **others** - Support components

#### **Landing Page** (`landing/` folder)

- **HeroSection.tsx** - Main banner
- **FeaturesSection.tsx** - Key features overview
- **HowItWorksSection.tsx** - Usage guide
- **CTASection.tsx** - Call-to-action buttons
- **Navbar.tsx** - Navigation menu
- Footer and other sections

---

## Environment Variables

### Backend `.env` File

```env
# Server Configuration
PORT=5000
NODE_ENV=production

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/uacn-gpt

# JWT Secret (CRITICAL - Change in Production)
UACN_GPT_JWT_SECRET=your-super-secret-key-at-least-32-characters

# OpenAI Configuration
OPENAI_API_KEY=sk-...
OPEN_AI_MODEL=gpt-4o-mini

# Email Service (Resend)
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@uacngpt.com
FRONTEND_URL=http://localhost:3000

# Search Service (Optional)
SEARCH_API_PROVIDER=serpapi
SEARCH_API_KEY=your_serpapi_key

# Cors settings
CORS_ORIGIN=http://localhost:3000
```

### Frontend `.env` File (if needed)

```env
VITE_API_URL=http://localhost:5000
VITE_ENV=development
```

---

## Setup & Installation

### Prerequisites

- **Node.js 20+** - [Download](https://nodejs.org/)
- **MongoDB** - [Atlas Cluster](https://www.mongodb.com/cloud/atlas) or local installation
- **API Keys**:
  - OpenAI API key from https://platform.openai.com
  - Resend API key from https://resend.com
  - (Optional) SerpAPI key from https://serpapi.com

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd UACN-GPT
```

### Step 2: Install Dependencies

```bash
# Install root workspace dependencies
npm install

# Dependencies are installed for both backend and frontend
# (Monorepo workspace structure via npm workspaces)
```

### Step 3: Configure Environment Variables

#### Backend Configuration
```bash
cd backend
cp .env.example .env  # or create manually
```

Edit `backend/.env` with your credentials:

```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/uacn-gpt
UACN_GPT_JWT_SECRET=generate-a-random-secret-key
OPENAI_API_KEY=sk-your-key
RESEND_API_KEY=re_your-key
FROM_EMAIL=noreply@uacngpt.com
FRONTEND_URL=http://localhost:3000
```

#### Frontend Configuration (if separate .env needed)
```bash
cd frontend
# Vite typically picks up from environment or hardcoded API base
# Default: http://localhost:5000
```

### Step 4: Setup MongoDB

**Option A: MongoDB Atlas (Cloud)**
1. Create account at https://www.mongodb.com/cloud/atlas
2. Create new project and cluster
3. Get connection string
4. Add to `.env`: `MONGODB_URI=mongodb+srv://...`

**Option B: Local MongoDB**
```bash
# Install MongoDB (if not already)
# Start MongoDB service (Windows)
net start MongoDB

# Connection string: mongodb://localhost:27017/uacn-gpt
```

### Step 5: Initialize Database (First Time)

The app creates collections automatically on first run via Mongoose schemas.

### Step 6: Start Development Servers

```bash
# From root directory (UACN-GPT/)
npm run dev

# This starts both backend and frontend concurrently
# Backend: http://localhost:5000
# Frontend: http://localhost:3000
```

Or run separately:
```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

### Step 7: Test the Application

1. Open http://localhost:3000
2. Create user account
3. Verify email (check terminal for OTP or use Resend dashboard)
4. Login and test chat
5. Create admin account to test policy uploads

---

## Development Workflow

### Common Development Tasks

#### Add New Business Unit

1. **Update backend models**:
   - Edit `backend/src/models/User.ts` - add to enum
   - Edit `backend/src/models/AdminUser.ts` - add to enum

2. **Update configuration**:
   - Edit `backend/src/config/businessUnits.ts` - add BU config

3. **Update frontend**:
   - Update business unit dropdown lists in registration/login components

4. **Database setup**:
   - Insert record in `BusinessUnit` collection
   - Insert record in `BusinessUnitEmailMapping` collection if using domain validation

#### Add New API Endpoint

1. Create handler in appropriate `routes/` file
2. Add TypeScript interfaces for request/response
3. Add authentication middleware if needed
4. Add error handling
5. Document in API section above
6. Test with Postman/curl

#### Add New Frontend Component

1. Create `.tsx` file in appropriate `src/` subfolder
2. Use Tailwind CSS for styling
3. Import and use Radix UI components if needed
4. Export from index files for easier imports
5. Test responsiveness

#### Run Type Checking

```bash
# Backend
cd backend
npx tsc --noEmit

# Frontend
cd frontend
npx tsc --noEmit
```

#### Build for Production

```bash
# From root
npm run build

# Creates:
# - backend/dist/
# - frontend/dist/
```

---

## Deployment Guide

### Backend Deployment

#### Deploy to Heroku (Example)

```bash
# Install Heroku CLI
# heroku login

# Create app
heroku create uacn-gpt-backend

# Set environment variables
heroku config:set MONGODB_URI=your_db_uri
heroku config:set UACN_GPT_JWT_SECRET=your_secret
heroku config:set OPENAI_API_KEY=your_key
heroku config:set RESEND_API_KEY=your_key

# Deploy
git push heroku main
```

#### Deploy to AWS EC2

```bash
# SSH into EC2 instance
ssh -i key.pem ubuntu@instance-ip

# Clone repository
git clone <repo>
cd UACN-GPT/backend

# Install Node/npm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
npm install

# Set environment variables
export MONGODB_URI=...
export UACN_GPT_JWT_SECRET=...

# Build and start
npm run build
npm start

# Use PM2 for process management
npm install -g pm2
pm2 start dist/index.js --name "uacn-gpt-api"
```

### Frontend Deployment

#### Deploy to Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd frontend
vercel

# Set environment variables interactively or in vercel.json
```

#### Deploy to Netlify

```bash
# Build
cd frontend
npm run build

# Upload dist/ folder to Netlify
# OR use Netlify CLI
npm install -g netlify-cli
netlify deploy --dir=dist
```

### Database Backup & Maintenance

```bash
# Backup MongoDB Atlas (daily automatic backups included)

# For local MongoDB:
mongodump --db uacn-gpt --out /backup/location

# Restore:
mongorestore --db uacn-gpt /backup/location/uacn-gpt
```

---

## Key Features

### 1. Multi-Tenant Architecture

- **Complete data isolation** between business units
- Users can only see policies for their BU
- Admins limited to their BU (except SUPERADMIN)
- Queries filtered by `businessUnit` field

### 2. Email Verification System

- **OTP-based** email verification on signup
- 10-minute OTP expiry
- Beautiful HTML email templates via Resend
- Resend verification flow available

### 3. Policy Context Injection

- Policies uploaded to MongoDB
- Parsed text injected into system prompt
- AI responds based on company documents
- Falls back to general knowledge if no policies match

### 4. Conversation Management

- **Persistent conversation history** per user
- Multiple conversation groups per user
- Full message thread visibility
- Export to PDF/DOCX format

### 5. Admin Dashboard

- **Policy upload** (PDF, DOCX, TXT)
- **Analytics** viewing
- User and policy management
- Business unit isolation

### 6. Intent Recognition

- Detects greetings, leave questions, salary questions, etc.
- Tailors responses based on intent
- Improves response relevance

---

## Authentication Flow

### User Registration & Login Flow

```
┌─────────────────────────────────────────────────────┐
│  1. User visits /register                            │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  2. Form submission:                                │
│  - email, password, fullName, businessUnit           │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  3. POST /api/auth/register                         │
│  - Validate email format                            │
│  - Check email domain matches BU                    │
│  - Hash password with bcryptjs                      │
│  - Generate 6-digit OTP                             │
│  - Save user (unverified)                           │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  4. Send OTP email via Resend                       │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  5. User enters OTP in verification page            │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  6. POST /api/auth/verify-email                     │
│  - Verify OTP matches & not expired                 │
│  - Mark email as verified                           │
│  - Send welcome email                               │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  7. User logins: POST /api/auth/login               │
│  - Verify email/password                            │
│  - Check email is verified                          │
│  - Create JWT token                                 │
│  - Return token + user data                         │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  8. Frontend stores token in localStorage           │
│  9. Token used in Authorization header for requests │
└─────────────────────────────────────────────────────┘
```

### JWT Token Structure

```
Header: {
  "alg": "HS256",
  "typ": "JWT"
}

Payload: {
  "userId": "mongo_id",
  "email": "user@example.com",
  "businessUnit": "GCL",
  "iat": 1704056400,
  "exp": 1704142800  // 24 hours
}
```

### Admin Authentication

Similar flow, but:
- Registration to `/api/admin/auth/register`
- Login to `/api/admin/auth/login`
- Token includes `isAdmin: true` and `adminId` fields
- Access controlled by `adminAuthMiddleware`

---

## Common Issues & Troubleshooting

### Issue: "Cannot find module 'mongoose'"

**Solution:**
```bash
cd backend
npm install mongoose
```

### Issue: CORS errors when frontend calls backend

**Solution:**
1. Check backend `index.ts` has CORS enabled
2. Verify CORS origin matches frontend URL
3. Ensure API calls use full URL: `http://localhost:5000/api/...`

**Code:**
```typescript
app.use(cors({
  origin: true,  // Or specify: ["http://localhost:3000"]
  credentials: true
}));
```

### Issue: "MONGODB_URI not found"

**Solution:**
1. Verify `.env` file exists in backend folder
2. Restart backend server after adding `.env`
3. Check `process.env.MONGODB_URI` is correctly referenced

### Issue: Email not sending

**Solution:**
1. Verify Resend API key is correct
2. Check `FROM_EMAIL` is a verified sender in Resend dashboard
3. Check Resend account has remaining credits
4. Verify internet connection

```bash
# Test API key:
curl https://api.resend.com/emails \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"from":"test@example.com","to":"user@example.com","subject":"Test","html":"Test"}'
```

### Issue: OpenAI API errors

**Solution:**
1. Verify API key is valid: `https://platform.openai.com/account/api-keys`
2. Check account has credits
3. Verify model name is correct (e.g., `gpt-4o-mini`)
4. Check rate limits haven't been exceeded

### Issue: MongoDB connection timeout

**Solution:**
1. Check internet connectivity
2. Verify MongoDB cluster is running (Atlas dashboard)
3. Check IP whitelist in MongoDB Atlas (add `0.0.0.0/0` for dev)
4. Verify connection string format

### Issue: "Email already exists"

**Solution:**
- Try resetting database: `db.users.deleteMany({})`
- Or use different email for testing

### Issue: TypeScript compilation errors

**Solution:**
```bash
# Clear and rebuild
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Issue: Frontend won't load after deployment

**Solution:**
1. Check frontend was built: `npm run build`
2. Verify backend serves frontend:
   ```typescript
   app.use(express.static(frontendDist));
   app.get('/', (req, res) => res.sendFile(frontendIndex));
   ```
3. Clear browser cache
4. Check browser console for 404 errors

---

## Future Enhancements

### Planned Features

1. **Vector Search/Semantic Search**
   - Use OpenAI embeddings for better policy matching
   - Implement vector database (e.g., Pinecone, Weaviate)

2. **RAG (Retrieval Augmented Generation)**
   - Improved context injection from multiple policies
   - Better relevance scoring

3. **User Feedback Loop**
   - Rate AI responses (helpful/not helpful)
   - Track which policies are most searched
   - Improve system prompts based on feedback

4. **Advanced Analytics**
   - User query patterns
   - Popular questions by department
   - Policy usage heatmaps
   - Custom report generation

5. **Internationalization**
   - Multi-language support
   - Regional customization

6. **Mobile App**
   - React Native or Flutter app
   - Offline mode for policies
   - Push notifications for policy updates

7. **Integration with HR Systems**
   - HRIS sync (employee data)
   - Leave management system integration
   - Payroll system queries

8. **Advanced Admin Features**
   - Policy versioning & history
   - Scheduled policy updates
   - A/B testing of policy documents
   - Advanced user role management

9. **Security Enhancements**
   - Two-factor authentication
   - SSO integration (LDAP/SAML)
   - Audit logging for policy access
   - End-to-end encryption for sensitive convos

10. **Performance Optimizations**
    - Caching layer (Redis)
    - CDN for frontend assets
    - Database query optimization
    - Lazy loading for chat messages

---

## Key Files Reference

| File | Purpose | Critical |
|---|---|---|
| `backend/src/index.ts` | Express app setup | Yes |
| `backend/src/middleware/auth.ts` | JWT validation | Yes |
| `backend/src/config/businessUnits.ts` | BU configuration | Yes |
| `backend/src/services/openaiService.ts` | AI integration | Yes |
| `backend/src/services/emailService.ts` | Email sending | Yes |
| `frontend/src/App.tsx` | Main router | Yes |
| `frontend/src/chat/ChatBot.tsx` | Chat UI | Yes |
| `.env` (backend) | Configuration | Critical |

---

## Contact & Support

- **Project Lead**: [Your Name]
- **Documentation**: This file
- **Issues**: Use GitHub Issues or internal tracking
- **API Support**: OpenAI Docs, MongoDB Docs, Resend Docs

---

## License

[Add appropriate license - e.g., MIT, Proprietary, etc.]

---

**Document Version:** 1.0.0  
**Last Updated:** March 30, 2026  
**Status:** Ready for Handover
