"use strict";
/**
 * Business Units Configuration for UACN Group
 * Maps abbreviations to full names and metadata
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUSINESS_UNITS = void 0;
exports.getBusinessUnitConfig = getBusinessUnitConfig;
exports.getAllBusinessUnitAbbrs = getAllBusinessUnitAbbrs;
exports.formatBusinessUnit = formatBusinessUnit;
exports.getUACNInfo = getUACNInfo;
exports.getUACNInfoString = getUACNInfoString;
exports.BUSINESS_UNITS = {
    GCL: {
        abbr: "GCL",
        fullName: "Grand Cereals Limited",
        label: "Grand Cereals Limited (GCL)",
        industry: "Food & Beverages",
        description: "Agriculture and cereal products manufacturing"
    },
    LSF: {
        abbr: "LSF",
        fullName: "Livestocks Feeds Limited",
        label: "Livestocks Feeds Limited (LSF)",
        industry: "Agriculture & Feeds",
        description: "Livestock feeds and animal nutrition products"
    },
    CAP: {
        abbr: "CAP",
        fullName: "Chemical and Allied Products PLC",
        label: "Chemical and Allied Products PLC (CAP)",
        industry: "Chemicals & Paints",
        description: "Chemical and paint manufacturing"
    },
    UFL: {
        abbr: "UFL",
        fullName: "UAC Foods Limited",
        label: "UAC Foods Limited (UFL)",
        industry: "Food & Beverages",
        description: "Innovative food products and brand management"
    },
    CHI: {
        abbr: "CHI",
        fullName: "Chivita|Hollandia Limited",
        label: "Chivita|Hollandia Limited (CHI)",
        industry: "Food & Beverages",
        description: "High-quality food and beverage products including fruit juices, dairy, and snacks"
    },
    "UAC-Restaurants": {
        abbr: "UAC-Restaurants",
        fullName: "UAC Restaurants",
        label: "UAC Restaurants",
        industry: "Food & Beverages",
        description: "Food and beverage restaurants and hospitality"
    },
    UPDC: {
        abbr: "UPDC",
        fullName: "UPDC Real Estate Investment Trust",
        label: "UPDC Real Estate Investment Trust (UPDC)",
        industry: "Real Estate",
        description: "Real estate investment and property management"
    },
    UACN: {
        abbr: "UACN",
        fullName: "United Africa Company of Nigeria (UACN Group)",
        label: "UACN Group (UACN)",
        industry: "Holding Company",
        description: "UACN Group - umbrella organization for all business units"
    }
};
/**
 * Get business unit config by abbreviation or full name
 */
function getBusinessUnitConfig(buIdentifier) {
    // First try direct lookup
    if (exports.BUSINESS_UNITS[buIdentifier]) {
        return exports.BUSINESS_UNITS[buIdentifier];
    }
    // Try case-insensitive lookup
    const key = Object.keys(exports.BUSINESS_UNITS).find(k => k.toLowerCase() === buIdentifier.toLowerCase());
    if (key) {
        return exports.BUSINESS_UNITS[key];
    }
    // Try matching by full name (case-insensitive)
    const byFullName = Object.values(exports.BUSINESS_UNITS).find(bu => bu.fullName.toLowerCase().includes(buIdentifier.toLowerCase()) ||
        buIdentifier.toLowerCase().includes(bu.abbr.toLowerCase()) ||
        // Handle "UAC of Nigeria" matching "UACN"
        (buIdentifier.toLowerCase().includes("uac") && bu.abbr === "UACN"));
    return byFullName || null;
}
/**
 * Get all business unit abbreviations
 */
function getAllBusinessUnitAbbrs() {
    return Object.keys(exports.BUSINESS_UNITS);
}
/**
 * Format business unit for display in responses
 */
function formatBusinessUnit(buIdentifier) {
    const config = getBusinessUnitConfig(buIdentifier);
    if (!config)
        return buIdentifier;
    return `${config.fullName} (${config.abbr})`;
}
/**
 * Get UACN parent company information
 */
function getUACNInfo() {
    return Object.values(exports.BUSINESS_UNITS);
}
/**
 * Get formatted UACN info string for display
 */
function getUACNInfoString() {
    return `UACN Group is a conglomerate with the following business units:
  
${Object.values(exports.BUSINESS_UNITS)
        .map(bu => `• **${bu.label}** - ${bu.description}`)
        .join("\n")}

Note: UFL stands for **UAC Foods Limited**, a key business unit in the UACN Group specializing in innovative food products.`;
}
