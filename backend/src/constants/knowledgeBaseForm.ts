/** Canonical knowledge-base categories (admin UI + API validation). */
export const KNOWLEDGE_BASE_CATEGORIES = [
  "Executive & Strategy",
  "Finance & Accounting",
  "Operations",
  "Human Resources",
  "Sales & Customer Success",
  "Marketing & Brand",
  "Legal & Compliance",
  "Technology & IT",
  "Supply Chain & Procurement",
  "Admin & Facilities",
  "Analytics & Data Layer",
  "Tacit Knowledge"
] as const;

export type KnowledgeBaseCategory = (typeof KNOWLEDGE_BASE_CATEGORIES)[number];
