"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminInvite = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const AdminInviteSchema = new mongoose_1.Schema({
    email: { type: String, required: true, lowercase: true, trim: true },
    fullName: { type: String, required: true },
    businessUnit: { type: String, required: true },
    tenantId: { type: String, required: true },
    token: { type: String, required: true },
    status: { type: String, enum: ["pending", "accepted", "expired"], default: "pending" },
    invitedBy: { type: String, required: true },
    expiresAt: { type: Date, required: true }
}, { timestamps: true });
// Index for fast token lookup and auto-expiry queries
AdminInviteSchema.index({ token: 1 });
AdminInviteSchema.index({ email: 1, businessUnit: 1 });
AdminInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
exports.AdminInvite = mongoose_1.default.model("AdminInvite", AdminInviteSchema);
