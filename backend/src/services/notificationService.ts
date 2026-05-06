import { Types } from "mongoose";
import { Notification, NotificationKind, RecipientType } from "../models/Notification";
import { User } from "../models/User";
import { AdminUser } from "../models/AdminUser";
import logger from "../utils/logger";

interface CreateInput {
  recipientId: Types.ObjectId | string;
  recipientType: RecipientType;
  businessUnit: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link?: string;
}

/** Fire-and-forget: never throws. Notification failures must never block the originating action. */
export async function createNotification(input: CreateInput): Promise<void> {
  try {
    await Notification.create({
      recipientId:
        typeof input.recipientId === "string"
          ? new Types.ObjectId(input.recipientId)
          : input.recipientId,
      recipientType: input.recipientType,
      businessUnit: input.businessUnit,
      kind: input.kind,
      title: input.title,
      body: input.body,
      link: input.link
    });
  } catch (err) {
    logger.error("[Notifications] create failed", {
      kind: input.kind,
      recipient: String(input.recipientId),
      err: (err as Error).message
    });
  }
}

/**
 * Notify employees in a BU about a new document. The audience is computed by stacking
 * any access constraints the doc has — group restrictions and/or a department tag —
 * so a Finance-tagged doc visible to "Marketing Team" only notifies users who are in
 * Marketing AND have department "Finance" (in practice usually nobody, which is fine).
 *
 * - userIds present → start from that set (group members)
 * - department present → further filter the set down to users in that department
 * - neither → fall back to every active user in the BU
 */
export async function notifyDocumentAdded(input: {
  businessUnit: string;
  title: string;
  documentId: string;
  uploadedBy: string;
  userIds?: string[];
  department?: string;
}): Promise<void> {
  try {
    const dept = input.department?.trim();
    const baseFilter: Record<string, unknown> = { isActive: { $ne: false } };

    if (input.userIds && input.userIds.length > 0) {
      baseFilter._id = { $in: input.userIds };
    } else {
      baseFilter.businessUnit = input.businessUnit;
    }
    if (dept) {
      baseFilter.department = dept;
    }

    const recipients = await User.find(baseFilter).select("_id").lean();

    const docs = recipients.map((u) => ({
      recipientId: u._id,
      recipientType: "user" as const,
      businessUnit: input.businessUnit,
      kind: "document_added" as const,
      title: "New document available",
      body: `"${input.title}" was added to your knowledge base by ${input.uploadedBy}.`,
      link: `/user-chat?doc=${input.documentId}`,
      read: false
    }));
    if (docs.length > 0) {
      await Notification.insertMany(docs);
    }
  } catch (err) {
    logger.error("[Notifications] notifyDocumentAdded failed", { err: (err as Error).message });
  }
}

/** Notify every super-admin that a new business has requested access. */
export async function notifySuperAdminsAccessRequest(input: {
  companyName: string;
  workEmail: string;
  requestId: string;
}): Promise<void> {
  try {
    const supers = await AdminUser.find({ businessUnit: "SUPERADMIN", isActive: { $ne: false } })
      .select("_id")
      .lean();
    const docs = supers.map((s) => ({
      recipientId: s._id,
      recipientType: "superadmin" as const,
      businessUnit: "SUPERADMIN",
      kind: "access_request_submitted" as const,
      title: "New access request",
      body: `${input.companyName} (${input.workEmail}) submitted an access request.`,
      link: `/super-admin/access-requests`,
      read: false
    }));
    if (docs.length > 0) {
      await Notification.insertMany(docs);
    }
  } catch (err) {
    logger.error("[Notifications] notifySuperAdminsAccessRequest failed", { err: (err as Error).message });
  }
}
