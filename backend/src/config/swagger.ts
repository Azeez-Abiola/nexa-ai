import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Nexa AI API",
      version: "1.0.0",
      description:
        "REST API for Nexa AI — the UAC Group internal AI assistant platform. Covers employee auth, admin auth, conversations, chat, policies, RAG documents, audit logs, analytics, and tenant provisioning."
    },
    servers: [
      { url: "/api/v1", description: "Current server" }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Employee JWT — obtained from POST /auth/login"
        },
        adminBearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Admin JWT — obtained from POST /admin/auth/login"
        }
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: { type: "string", example: "Something went wrong" }
          }
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string" },
            email: { type: "string" },
            fullName: { type: "string" },
            businessUnit: { type: "string", description: "Business unit identifier (slug or name)" },
            grade: { type: "string", enum: ["Executive","Senior VP","VP","Associate","Senior Analyst","Analyst"] },
            emailVerified: { type: "boolean" }
          }
        },
        ChatMessage: {
          type: "object",
          required: ["role", "content"],
          properties: {
            role: { type: "string", enum: ["user", "assistant"] },
            content: { type: "string" },
            timestamp: { type: "string", format: "date-time" }
          }
        },
        ConversationGroup: {
          type: "object",
          properties: {
            _id: { type: "string" },
            title: { type: "string" },
            messages: { type: "array", items: { $ref: "#/components/schemas/ChatMessage" } },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" }
          }
        },
        Policy: {
          type: "object",
          properties: {
            _id: { type: "string" },
            title: { type: "string" },
            category: { type: "string" },
            content: { type: "string" },
            businessUnit: { type: "string" },
            allowedGrades: { type: "array", items: { type: "string" } },
            tags: { type: "array", items: { type: "string" } },
            createdAt: { type: "string", format: "date-time" }
          }
        },
        RagDocument: {
          type: "object",
          properties: {
            _id: { type: "string" },
            title: { type: "string" },
            businessUnit: { type: "string" },
            documentType: { type: "string", enum: ["policy","procedure","handbook","contract","report","other"] },
            sensitivityLevel: { type: "string", enum: ["public","internal","confidential","restricted"] },
            allowedGrades: {
              type: "array",
              items: { type: "string", enum: ["ALL","Executive","Senior VP","VP","Associate","Senior Analyst","Analyst"] },
              description: "Use [\"ALL\"] to grant access to all grades, or list specific grades."
            },
            originalFilename: { type: "string" },
            fileSize: { type: "number" },
            processingStatus: { type: "string", enum: ["pending","extracting","chunking","embedding","completed","failed"] },
            totalChunks: { type: "number" },
            createdAt: { type: "string", format: "date-time" }
          }
        },
        UserDocument: {
          type: "object",
          description: "A document uploaded by an employee within a specific chat session. Processed asynchronously into vector embeddings for session-scoped RAG retrieval.",
          properties: {
            _id: { type: "string" },
            userId: { type: "string" },
            chatSessionId: { type: "string", description: "The conversation group ID this document belongs to" },
            fileName: { type: "string", example: "Q3-report.pdf" },
            fileType: { type: "string", example: "application/pdf" },
            fileSize: { type: "number", description: "File size in bytes" },
            fileUrl: { type: "string", description: "Cloudinary URL (not exposed publicly)" },
            status: {
              type: "string",
              enum: ["pending", "processing", "ready", "failed"],
              description: "pending → processing → ready (or failed). Users can query the document once status is 'ready'."
            },
            processingError: { type: "string", nullable: true },
            totalChunks: { type: "number", description: "Number of vector chunks produced after processing" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" }
          }
        },
        UploadedDocumentResult: {
          type: "object",
          description: "Outcome of a single file upload attempt within a chat message request.",
          properties: {
            fileName: { type: "string" },
            documentId: { type: "string", description: "ID of the created UserDocument record (empty string on failure)" },
            status: { type: "string", enum: ["pending", "failed"], description: "'pending' means upload succeeded and processing was queued; 'failed' means the upload itself failed." }
          }
        },
        AuditLog: {
          type: "object",
          properties: {
            _id: { type: "string" },
            eventType: { type: "string" },
            userId: { type: "string" },
            adminId: { type: "string" },
            businessUnit: { type: "string" },
            metadata: { type: "object" },
            createdAt: { type: "string", format: "date-time" }
          }
        },
        SharedConversation: {
          type: "object",
          properties: {
            shareId: { type: "string" },
            sharedAt: { type: "string", format: "date-time" },
            sharedBy: {
              type: "object",
              properties: {
                userId: { type: "string" },
                fullName: { type: "string" },
                email: { type: "string" }
              }
            },
            conversation: { $ref: "#/components/schemas/ConversationGroup" }
          }
        }
      }
    },
    tags: [
      { name: "Auth", description: "Employee registration, login, and password management" },
      { name: "Admin Auth", description: "Admin registration, login, user management, and password management" },
      { name: "Conversations", description: "Manage conversation threads and messages" },
      { name: "Conversation Sharing", description: "Share conversations with colleagues in the same business unit" },
      { name: "Session Documents", description: "Upload and manage documents scoped to a single chat session. Uploaded files are processed asynchronously into vector embeddings and used for RAG retrieval when the user asks questions in that session." },
      { name: "Chat", description: "Stateless chat endpoints (public and authenticated)" },
      { name: "Admin Policies", description: "CRUD for keyword-search policy documents" },
      { name: "Admin Documents", description: "Upload and manage RAG knowledge-base documents" },
      { name: "Audit Logs", description: "View system audit trail" },
      { name: "Analytics", description: "Dashboard stats, BU management, and email domain config" },
      { name: "Provisioning", description: "Tenant and admin invite lifecycle (SUPERADMIN only)" },
      { name: "Public", description: "Unauthenticated lookup endpoints" }
    ],
    paths: {

      // ─── AUTH ─────────────────────────────────────────────────────────────────

      "/auth/register": {
        post: {
          tags: ["Auth"],
          summary: "Register a new employee account",
          description: "Creates an unverified employee account and sends a 6-digit OTP to the provided email.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email","password","fullName","businessUnit","grade"],
                  properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string", minLength: 6 },
                    fullName: { type: "string" },
                    businessUnit: { type: "string", description: "Business unit identifier (slug or name)" },
                    grade: { type: "string", enum: ["Executive","Senior VP","VP","Associate","Senior Analyst","Analyst"] }
                  }
                }
              }
            }
          },
          responses: {
            "201": { description: "Account created, OTP sent" },
            "400": { description: "Validation error or invalid grade/BU" },
            "409": { description: "Email already registered" }
          }
        }
      },

      "/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Employee login",
          description: "Returns a signed JWT valid for 7 days.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email","password"],
                  properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string" }
                  }
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Login successful",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      token: { type: "string" },
                      user: { $ref: "#/components/schemas/User" }
                    }
                  }
                }
              }
            },
            "401": { description: "Invalid credentials" },
            "403": { description: "Email not verified" }
          }
        }
      },

      "/auth/verify-email": {
        post: {
          tags: ["Auth"],
          summary: "Verify employee email with OTP",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email","otp"],
                  properties: {
                    email: { type: "string", format: "email" },
                    otp: { type: "string", example: "123456" }
                  }
                }
              }
            }
          },
          responses: {
            "200": { description: "Email verified" },
            "400": { description: "Invalid or expired OTP" }
          }
        }
      },

      "/auth/resend-verification": {
        post: {
          tags: ["Auth"],
          summary: "Resend email verification OTP",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email"],
                  properties: { email: { type: "string", format: "email" } }
                }
              }
            }
          },
          responses: { "200": { description: "OTP resent (or silently ignored if email not found)" } }
        }
      },

      "/auth/forgot-password": {
        post: {
          tags: ["Auth"],
          summary: "Request a password reset link",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email"],
                  properties: { email: { type: "string", format: "email" } }
                }
              }
            }
          },
          responses: { "200": { description: "Reset link sent if account exists" } }
        }
      },

      "/auth/reset-password": {
        post: {
          tags: ["Auth"],
          summary: "Reset password using token from email",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["token","email","newPassword"],
                  properties: {
                    token: { type: "string" },
                    email: { type: "string", format: "email" },
                    newPassword: { type: "string", minLength: 6 }
                  }
                }
              }
            }
          },
          responses: {
            "200": { description: "Password reset successfully" },
            "400": { description: "Invalid or expired token" }
          }
        }
      },

      // ─── ADMIN AUTH ───────────────────────────────────────────────────────────

      "/admin/auth/register": {
        post: {
          tags: ["Admin Auth"],
          summary: "Register a new admin account",
          description: "Accepts multipart/form-data. An optional logo image can be attached when registering a new business unit.",
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["email","password"],
                  properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string", minLength: 6 },
                    fullName: { type: "string" },
                    businessUnit: { type: "string" },
                    slug: { type: "string", description: "Required for new business units" },
                    label: { type: "string" },
                    contactEmail: { type: "string", format: "email" },
                    logo: { type: "string", format: "binary" }
                  }
                }
              }
            }
          },
          responses: {
            "201": { description: "Admin account created, OTP sent" },
            "409": { description: "Admin already exists" }
          }
        }
      },

      "/admin/auth/login": {
        post: {
          tags: ["Admin Auth"],
          summary: "Admin login",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email","password"],
                  properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string" }
                  }
                }
              }
            }
          },
          responses: {
            "200": { description: "Login successful — returns admin JWT" },
            "401": { description: "Invalid credentials" },
            "403": { description: "Email not verified" }
          }
        }
      },

      "/admin/auth/verify-email": {
        post: {
          tags: ["Admin Auth"],
          summary: "Verify admin email with OTP",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email","otp"],
                  properties: {
                    email: { type: "string" },
                    otp: { type: "string" }
                  }
                }
              }
            }
          },
          responses: { "200": { description: "Email verified" } }
        }
      },

      "/admin/auth/resend-verification": {
        post: {
          tags: ["Admin Auth"],
          summary: "Resend admin verification OTP",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object", properties: { email: { type: "string" } } }
              }
            }
          },
          responses: { "200": { description: "OTP resent" } }
        }
      },

      "/admin/auth/forgot-password": {
        post: {
          tags: ["Admin Auth"],
          summary: "Request admin password reset link",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object", properties: { email: { type: "string" } } }
              }
            }
          },
          responses: { "200": { description: "Reset link sent if account exists" } }
        }
      },

      "/admin/auth/reset-password": {
        post: {
          tags: ["Admin Auth"],
          summary: "Reset admin password",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["token","email","newPassword"],
                  properties: {
                    token: { type: "string" },
                    email: { type: "string" },
                    newPassword: { type: "string", minLength: 6 }
                  }
                }
              }
            }
          },
          responses: { "200": { description: "Password reset successfully" } }
        }
      },

      "/admin/auth/admins": {
        get: {
          tags: ["Admin Auth"],
          summary: "List all BU admins (SUPERADMIN only)",
          security: [{ adminBearerAuth: [] }],
          responses: {
            "200": { description: "Array of admin accounts (passwords excluded)" },
            "403": { description: "SUPERADMIN access required" }
          }
        }
      },

      "/admin/auth/users": {
        get: {
          tags: ["Admin Auth"],
          summary: "List employees in a business unit",
          description: "BU admins see only their own BU. SUPERADMIN must supply `businessUnit` query param.",
          security: [{ adminBearerAuth: [] }],
          parameters: [
            {
              name: "businessUnit",
              in: "query",
              description: "Required for SUPERADMIN; inferred from token for BU admins",
              schema: { type: "string" }
            }
          ],
          responses: {
            "200": { description: "Array of user objects" },
            "400": { description: "businessUnit missing or invalid" }
          }
        }
      },

      // ─── CONVERSATIONS ────────────────────────────────────────────────────────

      "/conversations": {
        get: {
          tags: ["Conversations"],
          summary: "List all conversation groups for the authenticated user",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "Array of conversation groups",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      conversations: { type: "array", items: { $ref: "#/components/schemas/ConversationGroup" } }
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          tags: ["Conversations"],
          summary: "Create a new conversation group",
          security: [{ bearerAuth: [] }],
          responses: {
            "201": { description: "New conversation group created" }
          }
        }
      },

      "/conversations/shared-with-me": {
        get: {
          tags: ["Conversation Sharing"],
          summary: "List all conversations shared with the authenticated user",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "Array of shared conversation objects",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      sharedConversations: { type: "array", items: { $ref: "#/components/schemas/SharedConversation" } }
                    }
                  }
                }
              }
            }
          }
        }
      },

      "/conversations/shared/{shareId}": {
        delete: {
          tags: ["Conversation Sharing"],
          summary: "Revoke a share you created",
          description: "Only the original sharer can revoke. Permanently removes the share record.",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "shareId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Share revoked successfully" },
            "403": { description: "Not authorised to revoke this share" },
            "404": { description: "Share record not found" }
          }
        }
      },

      "/conversations/{id}": {
        get: {
          tags: ["Conversations"],
          summary: "Get a specific conversation group by ID",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Conversation group object" },
            "404": { description: "Not found" }
          }
        },
        put: {
          tags: ["Conversations"],
          summary: "Update conversation title",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["title"],
                  properties: { title: { type: "string" } }
                }
              }
            }
          },
          responses: {
            "200": { description: "Updated conversation group" },
            "404": { description: "Not found" }
          }
        },
        delete: {
          tags: ["Conversations"],
          summary: "Delete a conversation group",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Deleted successfully" },
            "404": { description: "Not found" }
          }
        }
      },

      "/conversations/{id}/share": {
        post: {
          tags: ["Conversation Sharing"],
          summary: "Share a conversation with a colleague",
          description: "Sender and recipient must belong to the same business unit. Duplicate shares are rejected with 409.",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, description: "Conversation group ID", schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["recipientEmail"],
                  properties: { recipientEmail: { type: "string", format: "email" } }
                }
              }
            }
          },
          responses: {
            "201": { description: "Conversation shared successfully" },
            "400": { description: "Missing recipientEmail or cannot share with yourself" },
            "403": { description: "You can only share conversations within your business unit" },
            "404": { description: "Conversation or recipient not found" },
            "409": { description: "Already shared with this user" }
          }
        }
      },

      "/conversations/{id}/message": {
        post: {
          tags: ["Conversations"],
          summary: "Send a message (with optional file upload) and get an AI response",
          description: `Accepts **multipart/form-data** (to attach files) or **application/json** (text-only, backward-compatible).

**File upload behaviour:**
- Supported formats: PDF, DOCX, XLSX, PPTX, TXT, CSV (max 10 MB per file, up to 5 per request, 10 per session).
- Uploaded files are stored in Cloudinary and queued for async processing (chunking + embedding).
- Once processing is complete (status = \`ready\`), the AI will automatically use them as context when answering questions in this session.
- If a file is still processing, the AI is informed and will tell the user to retry shortly.

**multipart field names:**
- \`message\` — the user's text (required unless uploading files only)
- \`files\` — one or more files (optional)

**Fallback:** When called with \`application/json\`, the field name \`content\` is also accepted (original behaviour preserved).`,
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, description: "Conversation group ID", schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string", description: "The user's text message (required unless uploading files only)" },
                    files: {
                      type: "array",
                      items: { type: "string", format: "binary" },
                      description: "PDF, DOCX, XLSX, PPTX, TXT, or CSV files (max 10 MB each, max 5 per request)"
                    }
                  }
                }
              },
              "application/json": {
                schema: {
                  type: "object",
                  required: ["content"],
                  properties: { content: { type: "string" } }
                }
              }
            }
          },
          responses: {
            "200": {
              description: "userMessage, assistantMessage, full conversation, and upload results returned",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      userMessage: { $ref: "#/components/schemas/ChatMessage" },
                      assistantMessage: { $ref: "#/components/schemas/ChatMessage" },
                      uploadedDocuments: {
                        type: "array",
                        items: { $ref: "#/components/schemas/UploadedDocumentResult" },
                        description: "Present only when files were attached to the request"
                      },
                      conversation: { $ref: "#/components/schemas/ConversationGroup" }
                    }
                  }
                }
              }
            },
            "400": { description: "Missing content/file, unsupported file type, or session document limit exceeded" },
            "404": { description: "Conversation not found" }
          }
        }
      },

      "/conversations/{id}/message-stream": {
        post: {
          tags: ["Conversations"],
          summary: "Stream an AI response (Server-Sent Events) — with optional file upload",
          description: `Same contract as \`POST /conversations/{id}/message\` but streams the AI response token-by-token via **Server-Sent Events**.

Each \`data:\` event is a JSON object:
- \`{ chunk, fullResponse }\` — incremental token
- \`{ done: true, fullResponse, conversation, uploadedDocuments? }\` — final event with full data

Accepts **multipart/form-data** (with files) or **application/json** (text-only).`,
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, description: "Conversation group ID", schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string", description: "The user's text message" },
                    files: {
                      type: "array",
                      items: { type: "string", format: "binary" },
                      description: "PDF, DOCX, XLSX, PPTX, TXT, or CSV files (max 10 MB each, max 5 per request)"
                    }
                  }
                }
              },
              "application/json": {
                schema: { type: "object", required: ["content"], properties: { content: { type: "string" } } }
              }
            }
          },
          responses: {
            "200": { description: "SSE stream — Content-Type: text/event-stream" },
            "400": { description: "Missing content/file, unsupported file type, or session document limit exceeded" }
          }
        }
      },

      "/conversations/{id}/documents": {
        get: {
          tags: ["Session Documents"],
          summary: "List documents uploaded to a chat session",
          description: "Returns all documents the authenticated user has uploaded to the specified conversation session, sorted newest first. Internal Cloudinary keys are never exposed.",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, description: "Conversation group ID", schema: { type: "string" } }],
          responses: {
            "200": {
              description: "Array of session documents",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      documents: {
                        type: "array",
                        items: { $ref: "#/components/schemas/UserDocument" }
                      }
                    }
                  }
                }
              }
            },
            "401": { description: "Unauthorized" }
          }
        }
      },

      "/conversations/{id}/documents/{docId}": {
        delete: {
          tags: ["Session Documents"],
          summary: "Delete a session document",
          description: "Permanently deletes the document record, all its vector chunks from the database, and the file from Cloudinary. The user must own the document and it must belong to the specified session.",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, description: "Conversation group ID", schema: { type: "string" } },
            { name: "docId", in: "path", required: true, description: "UserDocument ID", schema: { type: "string" } }
          ],
          responses: {
            "200": { description: "Document deleted successfully", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" } } } } } },
            "404": { description: "Document not found or does not belong to this user/session" }
          }
        }
      },

      "/conversations/{id}/message/{index}/edit": {
        post: {
          tags: ["Conversations"],
          summary: "Edit a user message and regenerate the AI response",
          description: "Replaces the message at `index` (must be a user message), removes the following assistant reply, and generates a new one.",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
            { name: "index", in: "path", required: true, description: "Zero-based message index", schema: { type: "integer" } }
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object", required: ["content"], properties: { content: { type: "string" } } }
              }
            }
          },
          responses: {
            "200": { description: "Edited message and new AI response returned" },
            "400": { description: "Invalid index or not a user message" }
          }
        }
      },

      // ─── CHAT ─────────────────────────────────────────────────────────────────

      "/chat": {
        post: {
          tags: ["Chat"],
          summary: "Authenticated stateless chat with RAG context",
          description: "Rate limited to 30 requests per minute per business unit. Greeting messages get an instant response without an AI call.",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["messages"],
                  properties: {
                    messages: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ChatMessage" }
                    }
                  }
                }
              }
            }
          },
          responses: {
            "200": { description: "AI reply string", content: { "application/json": { schema: { type: "object", properties: { reply: { type: "string" } } } } } },
            "429": { description: "Rate limit exceeded" }
          }
        }
      },

      "/chat/public": {
        post: {
          tags: ["Chat"],
          summary: "Unauthenticated public chat about UACN",
          description: "No authentication required. Uses Google search for context. Does not query internal policy documents.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["messages"],
                  properties: { messages: { type: "array", items: { $ref: "#/components/schemas/ChatMessage" } } }
                }
              }
            }
          },
          responses: { "200": { description: "AI reply" } }
        }
      },

      "/chat/public/stream": {
        post: {
          tags: ["Chat"],
          summary: "Unauthenticated public chat — streaming (SSE)",
          description: "Returns a text/event-stream. Events: `{ type: 'chunk', content }`, `{ type: 'done' }`, `{ type: 'error' }`.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["messages"],
                  properties: { messages: { type: "array", items: { $ref: "#/components/schemas/ChatMessage" } } }
                }
              }
            }
          },
          responses: { "200": { description: "SSE stream — Content-Type: text/event-stream" } }
        }
      },

      // ─── ADMIN POLICIES ───────────────────────────────────────────────────────

      "/admin/policies": {
        get: {
          tags: ["Admin Policies"],
          summary: "List policies",
          description: "BU admins see only their own BU. SUPERADMIN sees all.",
          security: [{ adminBearerAuth: [] }],
          responses: { "200": { description: "Array of policy objects" } }
        },
        post: {
          tags: ["Admin Policies"],
          summary: "Create a new policy",
          description: "Accepts either a plain JSON body or a multipart file upload (PDF, DOCX, TXT). Text is extracted automatically from files.",
          security: [{ adminBearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["title","category"],
                  properties: {
                    title: { type: "string" },
                    category: { type: "string" },
                    content: { type: "string", description: "Plain text content (omit if uploading a file)" },
                    file: { type: "string", format: "binary", description: "PDF, DOCX, or TXT file (omit if providing content)" },
                    allowedGrades: { type: "string", description: "Comma-separated grades, or an array" },
                    tags: { type: "string", description: "Comma-separated tags, or an array" },
                    businessUnit: { type: "string", description: "Required for SUPERADMIN" }
                  }
                }
              }
            }
          },
          responses: {
            "201": { description: "Policy created", content: { "application/json": { schema: { $ref: "#/components/schemas/Policy" } } } },
            "400": { description: "Missing required fields" }
          }
        }
      },

      "/admin/policies/{id}": {
        put: {
          tags: ["Admin Policies"],
          summary: "Update an existing policy",
          security: [{ adminBearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    category: { type: "string" },
                    content: { type: "string" },
                    allowedGrades: { type: "array", items: { type: "string" } },
                    tags: { type: "array", items: { type: "string" } }
                  }
                }
              }
            }
          },
          responses: {
            "200": { description: "Updated policy" },
            "403": { description: "Cannot modify another BU's policy" },
            "404": { description: "Policy not found" }
          }
        },
        delete: {
          tags: ["Admin Policies"],
          summary: "Delete a policy",
          security: [{ adminBearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Deleted" },
            "403": { description: "Cannot delete another BU's policy" },
            "404": { description: "Policy not found" }
          }
        }
      },

      // ─── ADMIN DOCUMENTS ──────────────────────────────────────────────────────

      "/admin/documents": {
        get: {
          tags: ["Admin Documents"],
          summary: "List RAG documents",
          description: "Paginated. BU admins see only their BU. SUPERADMIN sees all.",
          security: [{ adminBearerAuth: [] }],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } }
          ],
          responses: {
            "200": {
              description: "Paginated document list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      documents: { type: "array", items: { $ref: "#/components/schemas/RagDocument" } },
                      total: { type: "number" },
                      page: { type: "number" },
                      limit: { type: "number" }
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          tags: ["Admin Documents"],
          summary: "Upload a new RAG document",
          description: "Accepted formats: PDF, DOCX, TXT, CSV (max 50MB). The file is uploaded to Cloudinary and queued for background chunking and embedding. If specific `allowedGrades` are set (not ALL), verified employees of those grades receive an email notification.",
          security: [{ adminBearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["file","title","documentType","sensitivityLevel"],
                  properties: {
                    file: { type: "string", format: "binary" },
                    title: { type: "string" },
                    documentType: { type: "string", enum: ["policy","procedure","handbook","contract","report","other"] },
                    sensitivityLevel: { type: "string", enum: ["public","internal","confidential","restricted"] },
                    allowedGrades: {
                      type: "string",
                      description: "Comma-separated. Use \"ALL\" to grant access to every grade in the BU without sending notifications. Leave empty for unrestricted access."
                    },
                    businessUnit: { type: "string", description: "Required for SUPERADMIN" }
                  }
                }
              }
            }
          },
          responses: {
            "201": { description: "Document uploaded and processing queued" },
            "400": { description: "Missing required fields or unsupported file type" }
          }
        }
      },

      "/admin/documents/status/summary": {
        get: {
          tags: ["Admin Documents"],
          summary: "Processing status summary",
          description: "Returns a count per processing status (pending, extracting, chunking, embedding, completed, failed).",
          security: [{ adminBearerAuth: [] }],
          responses: { "200": { description: "Status count map" } }
        }
      },

      "/admin/documents/{id}": {
        get: {
          tags: ["Admin Documents"],
          summary: "Get a single document by ID",
          security: [{ adminBearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Document object" },
            "403": { description: "Access denied" },
            "404": { description: "Not found" }
          }
        },
        delete: {
          tags: ["Admin Documents"],
          summary: "Delete a document",
          description: "Removes the document, all its chunks, and the Cloudinary file.",
          security: [{ adminBearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Deleted successfully" },
            "404": { description: "Not found" }
          }
        }
      },

      "/admin/documents/{id}/reprocess": {
        post: {
          tags: ["Admin Documents"],
          summary: "Re-queue a document for processing",
          description: "Deletes existing chunks, resets status to pending, and enqueues a new processing job.",
          security: [{ adminBearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Reprocessing started" },
            "404": { description: "Document not found" }
          }
        }
      },

      // ─── AUDIT LOGS ───────────────────────────────────────────────────────────

      "/admin/audit-logs": {
        get: {
          tags: ["Audit Logs"],
          summary: "Query the audit trail",
          description: "Paginated and filterable. BU admins see only their BU. SUPERADMIN sees all. Logs auto-expire after 90 days.",
          security: [{ adminBearerAuth: [] }],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 200 } },
            { name: "eventType", in: "query", schema: { type: "string", description: "Filter by event type" } },
            { name: "documentId", in: "query", schema: { type: "string" } },
            { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
            { name: "to", in: "query", schema: { type: "string", format: "date-time" } }
          ],
          responses: {
            "200": {
              description: "Paginated audit logs",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      logs: { type: "array", items: { $ref: "#/components/schemas/AuditLog" } },
                      total: { type: "number" },
                      page: { type: "number" },
                      limit: { type: "number" }
                    }
                  }
                }
              }
            }
          }
        }
      },

      // ─── ANALYTICS ───────────────────────────────────────────────────────────

      "/analytics/dashboard": {
        get: {
          tags: ["Analytics"],
          summary: "Overall dashboard stats",
          description: "Returns total users, admins, conversations, and policies. BU-scoped for non-SUPERADMIN.",
          security: [{ adminBearerAuth: [] }],
          responses: { "200": { description: "{ totalUsers, totalAdmins, totalConversations, totalPolicies }" } }
        }
      },

      "/analytics/business-units": {
        get: {
          tags: ["Analytics"],
          summary: "Stats per business unit (SUPERADMIN only)",
          security: [{ adminBearerAuth: [] }],
          responses: { "200": { description: "Array of { name, users, admins, policies, conversations }" } }
        }
      },

      "/analytics/popular-policies": {
        get: {
          tags: ["Analytics"],
          summary: "Most recently created policies",
          security: [{ adminBearerAuth: [] }],
          parameters: [{ name: "limit", in: "query", schema: { type: "integer", default: 10 } }],
          responses: { "200": { description: "Array of policy summaries" } }
        }
      },

      "/analytics/chat-activity": {
        get: {
          tags: ["Analytics"],
          summary: "Daily conversation activity for the last 7 days",
          security: [{ adminBearerAuth: [] }],
          responses: { "200": { description: "Array of { _id: 'YYYY-MM-DD', count }" } }
        }
      },

      "/analytics/usage-by-bu": {
        get: {
          tags: ["Analytics"],
          summary: "User count per business unit (SUPERADMIN only)",
          security: [{ adminBearerAuth: [] }],
          responses: { "200": { description: "Array of { bu, users }" } }
        }
      },

      "/analytics/reset-password": {
        post: {
          tags: ["Analytics"],
          summary: "Force-reset an employee password (SUPERADMIN only)",
          security: [{ adminBearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["userId","newPassword"],
                  properties: {
                    userId: { type: "string" },
                    newPassword: { type: "string", minLength: 6 }
                  }
                }
              }
            }
          },
          responses: {
            "200": { description: "Password reset successfully" },
            "404": { description: "User not found" }
          }
        }
      },

      "/analytics/business-units-list": {
        get: {
          tags: ["Analytics"],
          summary: "List all active business units (any admin)",
          security: [{ adminBearerAuth: [] }],
          responses: { "200": { description: "Array of { name, label, _id }" } }
        }
      },

      "/analytics/business-units/{id}": {
        put: {
          tags: ["Analytics"],
          summary: "Update a business unit (SUPERADMIN only)",
          security: [{ adminBearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name","label"],
                  properties: {
                    name: { type: "string" },
                    label: { type: "string" },
                    isActive: { type: "boolean" },
                    contactEmail: { type: "string" }
                  }
                }
              }
            }
          },
          responses: { "200": { description: "Updated" }, "404": { description: "Not found" } }
        },
        delete: {
          tags: ["Analytics"],
          summary: "Delete a business unit (SUPERADMIN only)",
          description: "Fails if any users or admins are still assigned to the BU.",
          security: [{ adminBearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Deleted" },
            "400": { description: "BU still has assigned users/admins" },
            "404": { description: "Not found" }
          }
        }
      },

      "/analytics/email-domains": {
        get: {
          tags: ["Analytics"],
          summary: "List all email domain mappings (SUPERADMIN only)",
          security: [{ adminBearerAuth: [] }],
          responses: { "200": { description: "Array of domain mapping objects" } }
        }
      },

      "/analytics/email-domain": {
        post: {
          tags: ["Analytics"],
          summary: "Create or update an email domain mapping (SUPERADMIN only)",
          description: "Restricts employee registration for a BU to a specific email domain (e.g. @gcl.uacn.com).",
          security: [{ adminBearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["businessUnit","emailDomain"],
                  properties: {
                    businessUnit: { type: "string" },
                    emailDomain: { type: "string", example: "gcl.uacn.com" }
                  }
                }
              }
            }
          },
          responses: { "200": { description: "Mapping saved" } }
        }
      },

      "/analytics/email-domain/{id}": {
        delete: {
          tags: ["Analytics"],
          summary: "Delete an email domain mapping (SUPERADMIN only)",
          security: [{ adminBearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Deleted" }, "404": { description: "Not found" } }
        }
      },

      // ─── PROVISIONING ─────────────────────────────────────────────────────────

      "/provisioning/tenants": {
        get: {
          tags: ["Provisioning"],
          summary: "List all tenants (SUPERADMIN only)",
          security: [{ adminBearerAuth: [] }],
          responses: { "200": { description: "Array of tenant/BusinessUnit documents" } }
        },
        post: {
          tags: ["Provisioning"],
          summary: "Create a new tenant (SUPERADMIN only)",
          description: "Accepts multipart/form-data so a logo can be attached. The slug becomes the subdomain (e.g. `gcl` → `gcl.nexa.ai`).",
          security: [{ adminBearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["name","label","slug"],
                  properties: {
                    name: { type: "string", description: "BU abbreviation, e.g. GCL" },
                    label: { type: "string", description: "Human-readable name" },
                    slug: { type: "string", description: "Lowercase, hyphens only. Used for subdomain." },
                    contactEmail: { type: "string", format: "email" },
                    logo: { type: "string", format: "binary" }
                  }
                }
              }
            }
          },
          responses: {
            "201": { description: "Tenant created with tenantId and subdomain" },
            "409": { description: "Name or slug already taken" }
          }
        }
      },

      "/provisioning/tenants/{id}": {
        put: {
          tags: ["Provisioning"],
          summary: "Update a tenant (SUPERADMIN only)",
          security: [{ adminBearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: false,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    slug: { type: "string" },
                    contactEmail: { type: "string" },
                    isActive: { type: "boolean" },
                    logo: { type: "string", format: "binary" }
                  }
                }
              }
            }
          },
          responses: { "200": { description: "Tenant updated" }, "404": { description: "Not found" } }
        }
      },

      "/provisioning/invite": {
        post: {
          tags: ["Provisioning"],
          summary: "Invite a BU admin (SUPERADMIN only)",
          description: "Sends a 48-hour invite link to the specified email. Any previous pending invite for the same email+BU is expired automatically.",
          security: [{ adminBearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email","fullName","businessUnit"],
                  properties: {
                    email: { type: "string", format: "email" },
                    fullName: { type: "string" },
                    businessUnit: { type: "string" }
                  }
                }
              }
            }
          },
          responses: {
            "201": { description: "Invite sent" },
            "404": { description: "Business unit not found" },
            "409": { description: "Admin account already exists with this email" }
          }
        }
      },

      "/provisioning/invites": {
        get: {
          tags: ["Provisioning"],
          summary: "List all admin invites (SUPERADMIN only)",
          security: [{ adminBearerAuth: [] }],
          responses: { "200": { description: "Array of invite records" } }
        }
      },

      "/provisioning/invites/{id}": {
        delete: {
          tags: ["Provisioning"],
          summary: "Revoke a pending invite (SUPERADMIN only)",
          security: [{ adminBearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Invite revoked" },
            "400": { description: "Only pending invites can be revoked" },
            "404": { description: "Invite not found" }
          }
        }
      },

      "/provisioning/invite/verify": {
        get: {
          tags: ["Provisioning"],
          summary: "Validate an invite token before showing the set-password form",
          parameters: [{ name: "token", in: "query", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "{ valid: true, email, fullName, businessUnit }" },
            "400": { description: "Invalid or expired invite link" }
          }
        }
      },

      "/provisioning/invite/accept": {
        post: {
          tags: ["Provisioning"],
          summary: "Accept an invite and set a password",
          description: "Creates the admin account (pre-verified, no OTP required) and marks the invite as accepted.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["token","password"],
                  properties: {
                    token: { type: "string" },
                    password: { type: "string", minLength: 6 }
                  }
                }
              }
            }
          },
          responses: {
            "200": { description: "Account created, can now log in" },
            "400": { description: "Invalid or expired invite" },
            "409": { description: "Account already exists" }
          }
        }
      },

      // ─── PUBLIC ───────────────────────────────────────────────────────────────

      "/public/business-units": {
        get: {
          tags: ["Public"],
          summary: "List all business units",
          description: "Used by the registration form to populate the BU dropdown. No auth required.",
          responses: {
            "200": {
              description: "Array of { value, label, name }",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      businessUnits: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            value: { type: "string" },
                            label: { type: "string" },
                            name: { type: "string" }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },

      "/public/business-unit-names": {
        get: {
          tags: ["Public"],
          summary: "List business unit name abbreviations only",
          description: "Lightweight endpoint used by the super-admin control panel sidebar.",
          responses: { "200": { description: "{ names: string[] }" } }
        }
      },

      "/public/grades": {
        get: {
          tags: ["Public"],
          summary: "List all employee grades for the registration form",
          description: "Returns the real employee grades only. `ALL` is a document access-control flag and is never returned here.",
          responses: {
            "200": {
              description: "{ grades: string[] }",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      grades: {
                        type: "array",
                        items: { type: "string" },
                        example: ["Executive","Senior VP","VP","Associate","Senior Analyst","Analyst"]
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  apis: []
};

export const swaggerSpec = swaggerJsdoc(options);
