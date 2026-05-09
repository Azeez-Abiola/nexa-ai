# Nexa AI — Product Requirements Document (PRD)

**Version:** 2.0  
**Date:** May 2026  
**Status:** Active Development  
**Prepared by:** Nexa AI Product Team  
**Audience:** Engineering Team, Auditors, Stakeholders

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision & Goals](#2-product-vision--goals)
3. [System Architecture Overview](#3-system-architecture-overview)
4. [User Roles & Permissions](#4-user-roles--permissions)
5. [Authentication & Onboarding Flows](#5-authentication--onboarding-flows)
6. [Dashboard Types](#6-dashboard-types)
7. [AI Chat Interface](#7-ai-chat-interface)
8. [Knowledge Base & Document Management](#8-knowledge-base--document-management)
9. [User & Organisation Management](#9-user--organisation-management)
10. [Analytics & Reporting](#10-analytics--reporting)
11. [Audit Logging & Compliance](#11-audit-logging--compliance)
12. [Notifications System](#12-notifications-system)
13. [Tenant Provisioning & Multi-Tenancy](#13-tenant-provisioning--multi-tenancy)
14. [Email Communications](#14-email-communications)
15. [Security & Access Control](#15-security--access-control)
16. [NEW FEATURE — AI Model Selection](#16-new-feature--ai-model-selection)
17. [External Integrations](#17-external-integrations)
18. [Non-Functional Requirements](#18-non-functional-requirements)
19. [Data Models Reference](#19-data-models-reference)
20. [API Surface Reference](#20-api-surface-reference)
21. [Environment Configuration](#21-environment-configuration)
22. [Glossary](#22-glossary)

---

## 1. Executive Summary

Nexa AI is an enterprise-grade, multi-tenant AI assistant platform that enables organisations to deploy a branded, document-aware AI chat experience for their employees. Each organisation (called a **Business Unit** or **tenant**) receives an isolated environment with its own knowledge base, user management, branding, and analytics.

Employees interact with a conversational AI that answers questions grounded in company-specific documents — policies, handbooks, procedures, compliance materials — while administrators control what information is available, to whom, and at what sensitivity level.

The platform is operated at three levels:
- **Super Admins** — Nexa AI operators who provision and oversee all tenants
- **Business Unit Admins** — Tenant administrators who manage users and content
- **Employees** — End users who interact with the AI chat interface

---

## 2. Product Vision & Goals

### Vision
Empower every employee with instant, accurate, and policy-compliant answers from their organisation's own knowledge — without burdening HR, legal, or management teams with repetitive queries.

### Primary Goals
| Goal | Description |
|------|-------------|
| **Knowledge Democratisation** | Give every employee frictionless access to official company information |
| **Admin Efficiency** | Reduce repetitive internal queries via self-serve AI |
| **Compliance Assurance** | Ensure sensitive documents are only accessible to authorised users |
| **Scalability** | Support multiple independent organisations (tenants) on a single platform |
| **Auditability** | Maintain a complete, immutable 90-day audit trail of all platform activity |

### Success Metrics
- Time-to-answer for employees reduced vs. emailing HR/management
- Document knowledge base adoption rate per tenant
- Monthly active users per business unit
- Audit log completeness (100% coverage of defined event types)
- Email delivery success rate for invitations and notifications

---

## 3. System Architecture Overview

### Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Lucide icons, Recharts |
| **Backend** | Node.js, Express, TypeScript |
| **Database** | MongoDB (Mongoose ODM) with Atlas vector search |
| **Queue** | Redis + Bull (document processing workers) |
| **AI** | OpenAI GPT (primary), Anthropic Claude (upcoming), Kimi (upcoming) |
| **File Storage** | Cloudinary (documents, images, logos) |
| **Email** | Resend (transactional email, EJS templates) |
| **Search** | SerpAPI (Google Search integration for external context) |
| **Hosting** | Vercel (frontend), Railway (backend) |

### High-Level Architecture

```
┌─────────────────────────────────────────────┐
│               Frontend (Vercel)              │
│   Employee Chat | Admin Dashboard | Landing  │
└─────────────────────┬───────────────────────┘
                      │ HTTPS / REST API
┌─────────────────────▼───────────────────────┐
│              Backend API (Railway)           │
│   Express Router → Middleware → Controllers  │
│   Rate Limiting | JWT Auth | CORS            │
└────┬──────────┬──────────┬──────────────────┘
     │          │          │
┌────▼───┐ ┌───▼────┐ ┌───▼──────────────────┐
│MongoDB │ │ Redis  │ │  External Services    │
│Atlas   │ │ Queue  │ │  OpenAI / Claude /    │
│        │ │        │ │  Kimi / Cloudinary /  │
│        │ │ Worker │ │  Resend / SerpAPI     │
└────────┘ └────────┘ └──────────────────────┘
```

### Multi-Tenancy Model
Each tenant is fully isolated at the data layer via a `businessUnit` field indexed on every collection. There is no cross-tenant data leakage — queries are always scoped to the requesting user's business unit. Super admins have an elevated JWT that bypasses this scoping.

---

## 4. User Roles & Permissions

### 4.1 Role Hierarchy

```
Super Admin
    └── Business Unit Admin (per tenant)
            └── Employee (per tenant)
```

### 4.2 Permission Matrix

| Capability | Employee | BU Admin | Super Admin |
|-----------|----------|----------|-------------|
| AI Chat (company docs) | ✅ | ✅ | ✅ |
| AI Chat (external/public) | ✅ | ✅ | ✅ |
| View own conversations | ✅ | ✅ | ✅ |
| Share conversations | ✅ | ✅ | ✅ |
| Upload documents | ❌ | ✅ | ✅ |
| Manage knowledge base | ❌ | ✅ | ✅ |
| Invite employees | ❌ | ✅ | ✅ |
| Bulk invite via CSV | ❌ | ✅ | ✅ |
| Manage departments | ❌ | ✅ | ✅ |
| Manage user groups | ❌ | ✅ | ✅ |
| View BU analytics | ❌ | ✅ | ✅ |
| View audit logs (BU) | ❌ | ✅ | ✅ |
| Update BU branding | ❌ | ✅ | ✅ |
| Force password reset | ❌ | ✅ | ✅ |
| Manage all tenants | ❌ | ❌ | ✅ |
| Cross-tenant analytics | ❌ | ❌ | ✅ |
| Provision new tenants | ❌ | ❌ | ✅ |
| Manage email domains | ❌ | ❌ | ✅ |
| Review access requests | ❌ | ❌ | ✅ |
| View all audit logs | ❌ | ❌ | ✅ |

### 4.3 JWT Token Payloads

**Employee Token**
```json
{
  "userId": "...",
  "email": "jane@company.com",
  "businessUnit": "UACN Foods",
  "department": "Engineering",
  "tenantId": "uuid-v4",
  "tenantSlug": "uacn-foods",
  "tenantLogo": "/logos/uacn.png",
  "tenantColor": "#ed0000"
}
```

**Admin Token**
```json
{
  "adminId": "...",
  "email": "admin@company.com",
  "businessUnit": "UACN Foods",
  "tenantId": "uuid-v4",
  "isAdmin": true
}
```

**Super Admin Token**
```json
{
  "adminId": "...",
  "email": "superadmin@1879techhub.com",
  "businessUnit": "SUPERADMIN",
  "isSuperAdmin": true
}
```

---

## 5. Authentication & Onboarding Flows

### 5.1 Employee Self-Registration

```
1. Employee visits /login → clicks "Sign Up"
2. Fills: email, password, full name, selects business unit
3. System generates 6-digit OTP (10-min expiry)
4. Verification email sent (branded per tenant)
5. Employee enters OTP on /verify page
6. Email verified → JWT issued → welcome email sent
7. Redirected to AI chat interface
```

**Validations:** Email uniqueness, password minimum length, business unit must exist and be active.

---

### 5.2 Employee Invite Flow

```
1. BU Admin opens "Invite Employee" sheet → enters first name, last name, email, department
2. System creates EmployeeInvite record with hashed token (7-day expiry)
3. Invite email sent with signed acceptance link
4. Employee clicks link → /accept-employee-invite?token=...
5. Token verified → employee sets password
6. User record created → auto-login JWT issued
7. Redirected to chat interface
```

---

### 5.3 Bulk Employee Invite (CSV)

```
1. BU Admin opens "Invite Employee" sheet → switches to "Bulk invite" tab
2. Downloads CSV template (columns: First Name, Last Name, Email, Department)
3. Fills template with up to 200 rows
4. Uploads CSV → system parses with papaparse (browser-side)
5. Preview table shown: name, email, department badge
6. Admin clicks "Send X invites"
7. Backend processes each row:
   - Validates email domain (if domain mapping configured)
   - Checks for existing users and pending invites
   - Creates EmployeeInvite record
   - Sends invite email via Resend
8. Results shown: green success count + red failure list with per-row reasons
```

**Limits:** Maximum 200 employees per upload. Failed rows shown with exact reason (duplicate, wrong domain, email failure).

---

### 5.4 Admin Invitation Flow

```
1. Super Admin or existing BU Admin generates invite for a new admin
2. Admin invite email sent with 48-hour link
3. New admin clicks link → /accept-invite?token=...
4. Token verified → admin sets password
5. AdminUser record created → auto-login JWT issued
6. Redirected to admin dashboard
```

---

### 5.5 Tenant Access Request Flow

```
1. Company representative visits landing page → clicks "Request Access"
2. Fills: company name, work email, phone, employee count
3. TenantRequest created (status: pending)
4. Confirmation email sent to requester
5. Super Admin receives in-app notification + email notification
6. Super Admin reviews on /super-admin/access-requests
7a. If APPROVED:
    - BusinessUnit document created (auto slug, tenantId UUID)
    - AdminUser created with temporary password (mustChangePassword=true)
    - Tenant credentials email sent to company contact
    - TenantRequest.status → "provisioned"
7b. If REJECTED:
    - TenantRequest.status → "rejected" (with optional note)
    - Rejection email sent to requester
```

---

### 5.6 Password Reset Flow

```
1. User clicks "Forgot password" on login page
2. Enters email → system generates reset token (SHA-256 hashed, 1-hour expiry)
3. Password reset email sent with tokenised link
4. User clicks link → /reset-password?token=...
5. Token validated → user sets new password
6. Token invalidated → redirected to login
```

---

### 5.7 First-Login Password Change (Admin)

Admins provisioned via the access request flow receive a system-generated temporary password and have `mustChangePassword = true`. On first login they are prompted to set a new password before accessing the dashboard.

---

## 6. Dashboard Types

Nexa AI provides three distinct dashboard experiences tailored to each user role.

---

### 6.1 Employee Dashboard (Chat Interface)

**Route:** `/` and `/user-chat`  
**Audience:** Employees

The primary employee experience is the AI chat interface. There is no traditional "dashboard" with charts — the interface is conversational-first.

**Components:**
- **Chat home screen** — Quick-start suggestions based on the employee's accessible documents (latest 4 documents surfaced as prompt hints)
- **Chat input** — Text input with image attachment support
- **Message list** — Full conversation history with source citations rendered as clickable pills below AI responses
- **Typing indicator** — Animated indicator while AI processes response
- **Conversation panel** — Left sidebar with all past conversation sessions, accessible by name
- **Document export** — AI-generated Word, Excel, PowerPoint, or PDF documents downloadable from chat
- **Sharing** — Share an entire conversation or a single AI response with a colleague

---

### 6.2 Business Unit Admin Dashboard

**Route:** `/admin/dashboard`  
**Audience:** BU Admins

A data-rich overview of the business unit's AI usage and platform health.

**Metrics Cards:**
- Total registered users (active vs. deactivated)
- Total documents in knowledge base
- Total AI queries this month
- Active knowledge groups

**Charts & Visualisations (Recharts):**
- **Chat activity over time** — Daily query volume (30-day rolling line chart)
- **Top users** — Bar chart of most active employees by query count
- **Popular documents** — Most-queried documents in the knowledge base
- **Document processing status** — Breakdown of pending / processing / completed / failed

**Quick Actions:**
- Upload a document
- Invite an employee
- View audit logs
- Manage user groups

---

### 6.3 Super Admin Dashboard

**Route:** `/super-admin/dashboard`  
**Audience:** Super Admins

System-wide visibility across all tenants.

**Metrics Cards:**
- Total tenants (active vs. inactive)
- Total employees across all tenants
- Total documents across all tenants
- Total AI queries platform-wide (current month)
- Pending access requests (highlighted if > 0)

**Charts & Visualisations:**
- **Usage by business unit** — Horizontal bar chart of query volume per tenant
- **Cross-tenant activity over time** — Multi-line chart showing query trends per BU
- **Top tenants by document count** — Ranked list
- **Access request pipeline** — Count of pending / provisioned / rejected requests

**Quick Actions:**
- Review access requests
- Provision new tenant manually
- View all tenants
- View system audit logs

---

## 7. AI Chat Interface

### 7.1 How It Works

The chat system uses **Retrieval Augmented Generation (RAG)** to ground AI responses in company documents. When an employee sends a message:

```
1. User submits query
2. System checks for greeting patterns → returns custom greeting if matched
3. RAG retrieval: semantic + keyword search across user's accessible documents
4. Access control enforced: documents filtered by:
   - User's knowledge group memberships
   - Document sensitivity level
5. Google Search (SerpAPI) runs in parallel for external context
6. Hybrid context string assembled:
   - 📋 Company documents (higher priority)
   - 🌐 External search results (supplementary)
7. System prompt + context + conversation history → AI model API call
8. Response returned with source citations
9. Response saved to conversation history
```

### 7.2 Context & Source Citations

Each AI response includes:
- **Source pills** — Clickable document references shown beneath the response
- **External links** — Google search results as supplementary footnotes
- **Access redaction** — If a shared response references a document the recipient can't access, the source is hidden with an "Access Denied" indicator

### 7.3 Rate Limiting

- **30 requests per minute per business unit** (enforced at the API gateway level)
- Rate limit headers returned in response

### 7.4 Streaming Responses

Public-facing chat supports **Server-Sent Events (SSE)** for real-time token streaming:
- Event types: `chunk`, `done`, `error`
- Frontend renders tokens incrementally as they arrive

### 7.5 Document Export from Chat

Employees can request the AI to generate structured documents directly from chat:
- **Formats:** DOCX (Word), XLSX (Excel), PPTX (PowerPoint), PDF
- **Storage:** Cloudinary CDN
- **Download:** Authenticated download link valid for the session

### 7.6 Image Attachments in Chat

- Employees can attach images to messages (Cloudinary upload)
- Images preserved in conversation history for follow-up context
- Supported in authenticated sessions (not public chat)

### 7.7 Conversation Management

| Feature | Description |
|---------|-------------|
| **Conversation Groups** | Each named session is a "conversation group" containing all messages |
| **Auto-titling** | New conversations are auto-titled based on first message |
| **History persistence** | All conversations stored in MongoDB per user |
| **Message editing** | Users can edit previous messages and regenerate responses |
| **Deletion** | Users can delete individual conversation groups |

### 7.8 Conversation Sharing

**Peer-to-peer sharing (within BU):**
- Share entire conversation with a named colleague
- Share a single AI response + its preceding question
- Recipient sees the conversation in their "Shared with me" section
- Sources are redacted if recipient doesn't have access

**Public share links:**
- Admin or employee generates a shareable link
- Optional expiry date or permanent
- Anyone with the link can view the conversation (read-only)

---

## 8. Knowledge Base & Document Management

### 8.1 Supported File Formats

| Format | Extension | Processing |
|--------|-----------|-----------|
| PDF | `.pdf` | Text extraction → chunking → embedding |
| Word | `.docx` | Text extraction → chunking → embedding |
| Excel | `.xlsx` | Cell extraction → chunking → embedding |
| PowerPoint | `.pptx` | Slide text extraction → chunking → embedding |
| Plain text | `.txt` | Direct chunking → embedding |

### 8.2 Document Processing Pipeline

```
Upload → Cloudinary Storage
    → Bull Queue (Redis)
        → Worker: Extract text
        → Worker: Chunk text (token-aware splitting)
        → Worker: Generate embeddings (OpenAI)
        → MongoDB Atlas Vector Index
            → Status: completed
```

**Processing Statuses:**
- `pending` — Queued
- `extracting` — Text extraction in progress
- `chunking` — Text being split into chunks
- `embedding` — Embeddings being generated
- `completed` — Ready for RAG queries
- `failed` — Processing error (reprocessable)
- `superseded` — Replaced by newer version

### 8.3 Document Versioning

- Each document belongs to a `documentSeriesId` (groups all versions)
- Uploading a new version supersedes the previous one (`isLatestVersion = false` on old)
- RAG queries only use the latest version
- Version history retained for audit purposes

### 8.4 Sensitivity Levels

| Level | Description |
|-------|-------------|
| `public` | Visible to all employees in the BU |
| `internal` | Visible to all active employees |
| `confidential` | Visible to employees in specified knowledge groups |
| `restricted` | Visible only to specific knowledge groups (most sensitive) |

### 8.5 Knowledge Groups (Access Control)

Knowledge groups gate document access at a fine-grained level:

- Admin creates groups (e.g., "Finance Team", "Legal", "Senior Management")
- Documents can be assigned to one or more groups
- Employees are members of zero or more groups
- At chat time, only documents the employee's groups have access to are retrieved

### 8.6 Document Categories

BU Admins can define custom document categories (e.g., "Policy", "Handbook", "Compliance") with colour coding and icons. System-provided built-in categories are also available.

### 8.7 Admin Document Management UI

**Features:**
- Drag-and-drop upload with progress indicator
- Filter by status, category, sensitivity level, department
- Pagination for large knowledge bases
- Reprocess failed documents
- Delete documents (removes from vector index)
- Access restriction editing per document
- Employee notifications on new document upload

---

## 9. User & Organisation Management

### 9.1 User Directory

BU Admins access a paginated, searchable table of all users in their business unit showing:
- Full name and avatar initial
- Email address
- Department
- Role (Admin badge or Employee badge)
- User group memberships
- Account status (Active / Deactivated)
- Action: Activate / Deactivate

### 9.2 User Detail Page

Each user has a dedicated detail page showing:
- Profile header (name, email, business unit, join date, status badge)
- **Department management** — Reassign the user to a different department (dropdown + save)
- **User groups** — Current group memberships (navigate to groups to edit)
- **Chat sessions** — All AI conversation sessions with title, message count, and last active time
- **Account fields** — Email verified status, joined date, last updated
- **Activate / Deactivate** toggle with confirmation dialog

### 9.3 Departments

- BU Admins create and name departments
- Departments are used for document scoping and user organisation
- Department Detail page shows all members and linked documents

### 9.4 User Groups (Knowledge Groups)

- Fine-grained access control groups
- Admins add/remove members
- Groups linked to sensitive documents
- Visible on the User Detail page

### 9.5 Email Domain Whitelisting

Super Admins can configure allowed email domains per business unit. When a domain mapping exists, employee invites and self-registration are restricted to that domain (e.g., only `@uacnplc.com` addresses can join the UACN business unit).

---

## 10. Analytics & Reporting

### 10.1 BU Admin Analytics

Accessible at `/admin/analytics`.

| Metric | Description |
|--------|-------------|
| Total queries | Cumulative and monthly AI queries |
| Active users | Users who have chatted in the last 30 days |
| Document count | Total indexed documents |
| Chat activity chart | Daily query volume (30-day rolling) |
| Top users | Most active employees by query count |
| Popular documents | Most-cited documents in AI responses |

### 10.2 Super Admin Analytics

Accessible at `/super-admin/analytics`.

| Metric | Description |
|--------|-------------|
| Platform-wide totals | Total queries, users, documents, tenants |
| Usage by BU | Per-tenant query volume bar chart |
| Cross-tenant activity | Multi-line time-series chart |
| Access request pipeline | Status breakdown |
| Top tenants | Ranked by document count and usage |

---

## 11. Audit Logging & Compliance

### 11.1 Overview

Every significant platform action is written to the `AuditLog` collection. Logs are **immutable** and auto-expire after **90 days** via a MongoDB TTL index.

### 11.2 Audited Event Types

| Event Type | Trigger |
|-----------|---------|
| `admin_login` | Admin signs in |
| `admin_logout` | Admin signs out |
| `user_login` | Employee signs in |
| `user_logout` | Employee signs out |
| `user_created` | New employee account created |
| `user_deleted` | Employee account deleted |
| `document_upload_completed` | Document finishes uploading |
| `document_processing_started` | Processing pipeline begins |
| `document_processing_completed` | Processing pipeline succeeds |
| `document_processing_failed` | Processing pipeline fails |
| `rag_query` | Employee sends a chat message |
| `rag_retrieval_empty` | RAG returns no documents |
| `rag_access_denied` | User attempted to access restricted document |
| `chunk_embedding_batch_completed` | Embedding batch finishes |
| `conversation_shared` | Conversation shared with user |
| `conversation_share_denied` | Share attempt denied (access control) |
| `conversation_share_revoked` | Share revoked |
| `policy_created` | Policy document created |
| `policy_updated` | Policy document updated |
| `policy_deleted` | Policy document deleted |

### 11.3 Audit Log Fields

Each log entry contains:
- `eventType` — One of the types above
- `userId` / `adminId` — Actor identifier
- `adminEmail` — Email of the admin (for admin events)
- `businessUnit` — Tenant scope
- `action` — Human-readable action description
- `details` — Extended detail string
- `documentId` — Referenced document (if applicable)
- `metadata` — Flexible key-value store for event-specific data
- `createdAt` — Timestamp (TTL field, expires after 90 days)

### 11.4 Audit Log Filters (UI)

The Audit Logs page supports filtering by:
- **Event type** — Dropdown (all events, login, logout, document events, etc.)
- **Date presets** — Today, Yesterday, Last 7 days, Last 30 days
- **Custom date range** — From/to datetime pickers
- **Full-text search** — Searches admin email, action, and details fields

---

## 12. Notifications System

### 12.1 In-App Notifications

A bell icon in the admin navigation bar shows unread notification count.

| Notification Kind | Trigger | Recipient |
|------------------|---------|-----------|
| `document_added` | New document uploaded to knowledge base | All employees in BU with access |
| `access_request_submitted` | New tenant request received | Super Admin |
| `access_request_provisioned` | Access request approved | Requester (via email + in-app) |
| `access_request_rejected` | Access request rejected | Requester (via email + in-app) |
| `admin_provisioned` | New admin account created | New admin (via email) |

### 12.2 Notification Model

```
recipientId        — User or admin being notified
recipientType      — "user" | "admin" | "superadmin"
businessUnit       — Tenant scope
kind               — Notification type (see above)
title              — Short notification title
body               — Full notification message
link               — Optional deep-link to relevant page
read               — Boolean, default false
readAt             — Timestamp when marked read
```

### 12.3 Notification API

- `GET /api/v1/notifications` — Fetch all for current user (paginated)
- `GET /api/v1/notifications/unread-count` — Returns integer badge count
- `PATCH /api/v1/notifications/:id/read` — Mark single as read
- `PATCH /api/v1/notifications/read-all` — Bulk mark all as read

---

## 13. Tenant Provisioning & Multi-Tenancy

### 13.1 Tenant Structure

Each tenant represents one business unit / company division.

**Tenant fields:**
| Field | Description |
|-------|-------------|
| `tenantId` | Immutable UUID assigned at creation |
| `name` | Internal name used for data scoping |
| `label` | Display name shown in the UI |
| `slug` | URL-safe lowercase identifier |
| `logo` | Logo file path (Cloudinary) |
| `logoHash` | SHA-256 of logo file for deduplication |
| `isActive` | Whether the tenant is active |
| `contactEmail` | Primary contact email |
| `colorCode` | Brand colour (hex, default `#ed0000`) |

### 13.2 Tenant Management (Super Admin)

- **List all tenants** — Searchable table with user count, document count, status
- **Create tenant** — Logo upload, label, colour, contact email; auto-generates slug
- **Update tenant** — Edit any field, re-upload logo
- **Activate/deactivate** — Toggle tenant status (deactivated tenants cannot send invites)
- **Logo deduplication** — SHA-256 hash prevents duplicate logos across tenants

### 13.3 Access Request Review

Super Admins review incoming access requests at `/super-admin/access-requests`:
- View submitted company details
- Approve → auto-provisions tenant + admin credentials sent by email
- Reject → sends rejection email with optional note

---

## 14. Email Communications

All emails are sent via **Resend** using EJS HTML templates. The `FROM_EMAIL` address is configurable via environment variable.

### 14.1 Email Templates

| Template | Trigger | Key Variables |
|----------|---------|---------------|
| `verification.ejs` | Employee email verification | fullName, otp, businessUnit, brandColor |
| `welcome.ejs` | Post-verification welcome | fullName, chatUrl, buLabel, brandColor, logoUrl |
| `password-reset.ejs` | Password reset request | fullName, resetLink |
| `employee-invite.ejs` | Employee invited by admin | fullName, businessUnitLabel, inviterLabel, acceptLink, expiryDays |
| `admin-invite.ejs` | Admin invited by super admin | fullName, businessUnit, acceptLink |
| `tenant-credentials.ejs` | New tenant admin provisioned | fullName, businessUnit, email, password, loginUrl |
| `document-added.ejs` | New document in knowledge base | fullName, documentTitle, businessUnit, uploadedBy |
| `access-request-notification.ejs` | New access request (to super admin) | companyName, workEmail, employeeCount, reviewUrl |
| `access-request-received.ejs` | Access request confirmation (to requester) | companyName, workEmail |
| `access-request-rejected.ejs` | Access request rejected | companyName, note |

### 14.2 Branding in Emails

Welcome and verification emails are tenant-branded:
- Business unit name in subject line
- Brand colour applied to CTA buttons and accents
- Tenant logo included if configured

---

## 15. Security & Access Control

### 15.1 Authentication

- **JWT Bearer tokens** — All authenticated routes require `Authorization: Bearer <token>`
- **Token expiry** — 7 days (employee and admin tokens)
- **Separate token namespaces** — Employee tokens and admin tokens cannot be used interchangeably
- **Password hashing** — bcryptjs with salt rounds
- **OTP verification** — 6-digit code, 10-minute expiry
- **Invite token security** — Raw tokens sent by email; SHA-256 hash stored in DB

### 15.2 Document Access Control

Three-layer enforcement on every RAG query:

1. **Business unit scope** — User can only access documents from their own BU
2. **Sensitivity level** — `public`/`internal` open to all; `confidential`/`restricted` require group membership
3. **Knowledge group membership** — Document's `allowedGroupIds` checked against user's group memberships

### 15.3 API Security

- **Rate limiting** — 30 requests/min per BU on chat endpoints
- **Middleware** — `adminAuthMiddleware` and `authMiddleware` validate JWT on every protected route
- **Super admin gate** — `superAdminMiddleware` enforces `isSuperAdmin` on provisioning routes
- **Input validation** — Request bodies validated at route level before processing
- **CORS** — Configurable allowed origins

### 15.4 Data Isolation

- Every MongoDB query includes a `businessUnit` filter
- Admins cannot query users or documents from other tenants
- Super admin JWT grants platform-wide access — handled as a separate elevated credential

### 15.5 Audit Trail

All sensitive operations (logins, document actions, policy changes, share events) are logged to the immutable AuditLog collection with full actor and timestamp context.

---

## 16. NEW FEATURE — AI Model Selection

### 16.1 Overview

**Feature name:** AI Model Switcher  
**Target:** Chat interface (employee-facing)  
**Priority:** High  
**Status:** Planned

Currently all employee chat sessions run on a single configured OpenAI GPT model. This feature allows employees to switch AI models on a per-session or per-conversation basis from a dropdown selector in the chat interface.

---

### 16.2 Business Justification

- Different models have different strengths (reasoning, tone, speed, cost)
- Employees may prefer a specific model for specific tasks (e.g., Claude for long-form writing, Kimi for multilingual queries)
- Offering model choice improves user satisfaction and adoption
- Future-proofs the platform against model deprecations or cost changes

---

### 16.3 Supported Models (Phase 1)

| Model | Provider | Description | Default |
|-------|----------|-------------|---------|
| GPT (OpenAI) | OpenAI | Current production model — optimised for speed and general Q&A | ✅ Yes |
| Claude | Anthropic | Excellent for long-form reasoning, summarisation, and nuanced writing | ❌ |
| Kimi | Moonshot AI | Strong multilingual support and context handling | ❌ |

---

### 16.4 UX Design

**Location:** Chat input bar — model selector dropdown sits to the left of the send button.

**Dropdown design:**
```
┌──────────────────────────────────┐
│ 🤖 GPT (OpenAI)            ▾    │
├──────────────────────────────────┤
│ ✅  GPT (OpenAI)      Default   │
│     Claude (Anthropic)           │
│     Kimi (Moonshot)              │
└──────────────────────────────────┘
```

- Selected model shown with provider icon and name
- Default model pre-selected on every new session
- Selection persisted per conversation group (changing mid-conversation is allowed but the switch takes effect from the next message)
- A subtle badge appears in the message history when the model switches mid-conversation: `— Switched to Claude —`

---

### 16.5 Backend Requirements

#### 16.5.1 Chat Route Changes

The existing `POST /api/v1/chat/` route will accept a new optional field:

```typescript
body: {
  messages: ChatMessage[];
  model?: "gpt" | "claude" | "kimi";  // defaults to "gpt"
}
```

#### 16.5.2 Model Router Service

A new `modelRouter.ts` service will abstract the provider selection:

```typescript
type ModelKey = "gpt" | "claude" | "kimi";

async function callModel(
  model: ModelKey,
  systemPrompt: string,
  messages: ChatMessage[],
  options: ModelOptions
): Promise<string>
```

**Provider implementations:**

| Model | SDK/API | Key Env Var |
|-------|---------|-------------|
| GPT | `openai` npm package | `OPENAI_API_KEY` |
| Claude | `@anthropic-ai/sdk` | `ANTHROPIC_API_KEY` |
| Kimi | REST API (Moonshot) | `KIMI_API_KEY` |

#### 16.5.3 New Environment Variables

```
ANTHROPIC_API_KEY=sk-ant-...
KIMI_API_KEY=...
KIMI_API_BASE_URL=https://api.moonshot.cn/v1
```

#### 16.5.4 Model Configuration per Tenant (Future)

A future iteration will allow Super Admins to configure which models are enabled per tenant (e.g., a tenant may only want Claude for compliance reasons). For Phase 1, all three models are available to all tenants.

---

### 16.6 Conversation History Changes

The `ConversationGroup` model will store which model generated each message:

```typescript
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  model?: "gpt" | "claude" | "kimi";  // NEW: stored on assistant messages
  // ... existing fields
}
```

---

### 16.7 Audit Logging

Model usage will be captured in the `rag_query` audit event metadata:

```json
{
  "eventType": "rag_query",
  "metadata": {
    "model": "claude",
    "contextDocCount": 3,
    "externalResultCount": 2
  }
}
```

---

### 16.8 Acceptance Criteria

| # | Criterion |
|---|-----------|
| AC-1 | A model selector dropdown is visible in the chat input bar |
| AC-2 | GPT is pre-selected by default on every new conversation |
| AC-3 | Selecting Claude or Kimi routes the next message to the correct provider API |
| AC-4 | RAG context (company documents) is passed to all three models identically |
| AC-5 | Model switch mid-conversation shows a divider badge in message history |
| AC-6 | Selected model is stored on each assistant message in the DB |
| AC-7 | Model selection is included in `rag_query` audit log metadata |
| AC-8 | If a provider API is unavailable, a clear error is shown and GPT is used as fallback |
| AC-9 | Model selector does not appear on the public chat (unauthenticated) page |

---

### 16.9 Implementation Plan

**Phase 1 — Backend**
1. Install `@anthropic-ai/sdk` and configure Kimi REST client
2. Create `backend/src/services/modelRouter.ts` with provider abstraction
3. Update `POST /api/v1/chat/` to accept and route `model` param
4. Update `ConversationGroup` message schema to store `model` field
5. Update `rag_query` audit log to include model in metadata
6. Add `ANTHROPIC_API_KEY` and `KIMI_API_KEY` to Railway env vars

**Phase 2 — Frontend**
1. Add model selector component to `ChatBotInput.tsx`
2. Persist selected model in component state, passed with each message send
3. Store model preference in `localStorage` for cross-session persistence
4. Render model switch divider badge in `ChatMessage.tsx`
5. Update the `POST /api/v1/conversations/:id/message` call to include model param

---

## 17. External Integrations

| Service | Purpose | Configuration |
|---------|---------|--------------|
| **OpenAI** | GPT model for AI chat responses | `OPENAI_API_KEY`, `OPEN_AI_MODEL` |
| **Anthropic** | Claude model (new) | `ANTHROPIC_API_KEY` |
| **Moonshot AI (Kimi)** | Kimi model (new) | `KIMI_API_KEY`, `KIMI_API_BASE_URL` |
| **SerpAPI** | Google Search for external context | `SEARCH_API_KEY` |
| **Cloudinary** | Document and image storage/CDN | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| **Resend** | Transactional email delivery | `RESEND_API_KEY`, `FROM_EMAIL` |
| **MongoDB Atlas** | Primary database + vector search index | `MONGODB_URI` |
| **Redis** | Document processing queue (Bull) | `REDIS_HOST`, `REDIS_PORT` |

---

## 18. Non-Functional Requirements

### 18.1 Performance
- AI chat response time: < 5 seconds (P95)
- Document processing: < 2 minutes for a standard PDF (< 50 pages)
- API response time for non-AI routes: < 500ms (P95)
- Frontend initial load: < 3 seconds on 4G connection

### 18.2 Availability
- Target uptime: 99.5% monthly
- Railway auto-restarts on crash
- MongoDB Atlas managed replication for data durability

### 18.3 Scalability
- Multi-tenant data model scales horizontally (each tenant isolated by `businessUnit` index)
- Redis Bull queue for async document processing (workers scale independently)
- Cloudinary CDN for static asset delivery globally

### 18.4 Data Retention
- Audit logs: 90 days (MongoDB TTL index)
- Conversation history: Indefinite (until user deletes)
- Documents: Indefinite (until admin deletes)
- Invite tokens: Expire per configuration (7 days employee, 48h admin) via MongoDB TTL

### 18.5 Compliance
- Immutable audit logs for 90-day retention
- Role-based access control enforced at API layer
- Sensitive documents gated by knowledge group membership
- Passwords never stored in plaintext
- Invite tokens hashed before storage (only hash in DB, raw token only in email)

### 18.6 Browser Support
- Chrome 110+, Firefox 110+, Safari 16+, Edge 110+
- Responsive design: desktop-first, mobile-compatible

---

## 19. Data Models Reference

### Users
| Model | Collection | Key Fields |
|-------|-----------|-----------|
| `User` | `users` | email, fullName, businessUnit, department, password (hashed), emailVerified, isActive |
| `AdminUser` | `adminusers` | email, fullName, businessUnit, password (hashed), mustChangePassword, isActive |

### Authentication
| Model | Collection | Key Fields |
|-------|-----------|-----------|
| `AdminInvite` | `admininvites` | email, businessUnit, token (hashed), status, expiresAt (TTL) |
| `EmployeeInvite` | `employeeinvites` | email, businessUnit, department, token (hashed), status, expiresAt (TTL) |

### Conversations
| Model | Collection | Key Fields |
|-------|-----------|-----------|
| `Conversation` | `userconversations` | userId (unique), businessUnit, conversationGroups[] |
| `SharedConversation` | `sharedconversations` | conversationGroupId, sharedByUserId, sharedWithUserId, messageIndex |
| `ShareLink` | `sharelinks` | conversationId, createdBy, businessUnit, expiresAt |

### Documents
| Model | Collection | Key Fields |
|-------|-----------|-----------|
| `RagDocument` | `ragdocuments` | title, businessUnit, sensitivityLevel, processingStatus, allowedGroupIds[], version |
| `DocumentChunk` | `documentchunks` | ragDocumentId, chunkIndex, text, embedding |
| `UserDocument` | `userdocuments` | userId, conversationId, cloudinaryUrl |
| `DocumentCategory` | `documentcategories` | businessUnit, name, builtIn, color, icon |

### Organisation
| Model | Collection | Key Fields |
|-------|-----------|-----------|
| `BusinessUnit` | `businessunits` | tenantId, name, label, slug, logo, colorCode, isActive |
| `Department` | `departments` | businessUnit, name, description |
| `KnowledgeGroup` | `knowledgegroups` | businessUnit, name, memberUserIds[] |
| `BusinessUnitEmailMapping` | `businessunitemailmappings` | businessUnit, emailDomain |

### Platform Operations
| Model | Collection | Key Fields |
|-------|-----------|-----------|
| `AuditLog` | `auditlogs` | eventType, userId/adminId, businessUnit, action, createdAt (TTL 90d) |
| `Notification` | `notifications` | recipientId, kind, title, body, read |
| `TenantRequest` | `tenantrequests` | companyName, workEmail, status, provisionedTenantId |
| `Policy` | `policies` | businessUnit, title, category, content |

---

## 20. API Surface Reference

### Base URL
```
Production:  https://nexa-api.railway.app
Local:       http://localhost:4000
```

### Route Groups

| Prefix | Description | Auth |
|--------|-------------|------|
| `/api/v1/auth` | Employee authentication | Public / JWT |
| `/api/v1/admin/auth` | Admin authentication & user management | Admin JWT |
| `/api/v1/chat` | AI chat (authenticated + public) | JWT / Public |
| `/api/v1/conversations` | Conversation CRUD & sharing | JWT |
| `/api/v1/admin/documents` | Knowledge base document management | Admin JWT |
| `/api/v1/admin/user-groups` | Knowledge group management | Admin JWT |
| `/api/v1/admin/audit-logs` | Audit log queries | Admin JWT |
| `/api/v1/analytics` | Usage analytics | Admin JWT |
| `/api/v1/notifications` | In-app notifications | JWT |
| `/api/v1/provisioning` | Tenant provisioning | Super Admin JWT |
| `/api/v1/employee-invite` | Employee invite acceptance | Public (token) |
| `/api/v1/public` | Public-facing endpoints | Public |
| `/health` | Health check | Public |

---

## 21. Environment Configuration

### Backend Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default 4000) | No |
| `MONGODB_URI` | MongoDB Atlas connection string | Yes |
| `NEXA_AI_JWT_SECRET` | JWT signing secret | Yes |
| `OPENAI_API_KEY` | OpenAI API key | Yes |
| `OPEN_AI_MODEL` | OpenAI model ID (e.g. `gpt-4o-mini`) | No |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key (new) | For Claude |
| `KIMI_API_KEY` | Moonshot Kimi API key (new) | For Kimi |
| `KIMI_API_BASE_URL` | Kimi API base URL | For Kimi |
| `RESEND_API_KEY` | Resend email API key | Yes |
| `FROM_EMAIL` | Sender email address | Yes |
| `FRONTEND_URL` | Frontend base URL (for email links) | Yes |
| `SEARCH_API_KEY` | SerpAPI key for Google search | No |
| `SEARCH_API_PROVIDER` | Search provider (`serpapi`) | No |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account name | Yes |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Yes |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Yes |
| `REDIS_HOST` | Redis host | Yes |
| `REDIS_PORT` | Redis port | Yes |
| `SUPERADMIN_NOTIFICATION_EMAIL` | Super admin notification inbox | No |
| `SEED_SUPERADMIN_EMAIL` | Super admin seed email | Dev only |
| `SEED_SUPERADMIN_PASSWORD` | Super admin seed password | Dev only |

### Frontend Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL |

---

## 22. Glossary

| Term | Definition |
|------|-----------|
| **Business Unit (BU)** | A tenant — one company or division on the platform |
| **Tenant** | Synonymous with Business Unit |
| **Knowledge Base** | The collection of documents uploaded by a BU admin |
| **RAG** | Retrieval Augmented Generation — technique of grounding AI responses in specific documents |
| **Chunk** | A segment of a document (typically 200–500 tokens) stored with an embedding vector |
| **Embedding** | A numerical vector representation of text used for semantic similarity search |
| **Knowledge Group** | A named set of users who share access to specific documents |
| **Sensitivity Level** | Document access tier: public, internal, confidential, restricted |
| **Conversation Group** | A named chat session containing all messages between a user and the AI |
| **Super Admin** | A Nexa AI platform operator with cross-tenant access |
| **BU Admin** | An administrator for a single business unit tenant |
| **Employee** | An end user who chats with the AI |
| **Audit Log** | An immutable timestamped record of a significant platform action |
| **TTL Index** | MongoDB Time-To-Live index that auto-deletes documents after a set duration |
| **SSE** | Server-Sent Events — HTTP streaming protocol for real-time AI token delivery |
| **JWT** | JSON Web Token — signed bearer token used for authentication |
| **OTP** | One-Time Password — 6-digit code sent by email for verification |
| **Slug** | URL-safe lowercase identifier derived from a business unit name |
| **Model Switcher** | New feature allowing employees to choose between GPT, Claude, and Kimi |

---

*Document prepared by the Nexa AI Product Team. For questions contact the engineering lead or product owner.*
