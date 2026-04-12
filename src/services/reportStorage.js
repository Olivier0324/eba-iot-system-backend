// services/reportStorage.js — durable PDF storage for serverless (Cloudinary raw upload)
import fs from "fs";
import path from "path";
import cloudinary from "../config/cloudinary.js";

export function isCloudinaryReportStorageEnabled() {
    return Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );
}

/**
 * Upload a generated PDF from disk to Cloudinary as a raw asset, then caller should unlink the local file.
 * @returns {{ publicId: string, secureUrl: string, bytes: number }}
 */
export async function uploadReportPdfToCloudinary(localPdfPath) {
    const folder = (process.env.CLOUDINARY_REPORT_FOLDER || "eba_iot_reports").replace(/^\/+|\/+$/g, "");
    const publicIdBase = path.basename(localPdfPath, ".pdf");

    const result = await cloudinary.uploader.upload(localPdfPath, {
        resource_type: "raw",
        folder,
        public_id: publicIdBase,
        overwrite: false,
    });

    return {
        publicId: result.public_id,
        secureUrl: result.secure_url,
        bytes: Number(result.bytes) || Number(result.size) || 0,
    };
}

/** Remove raw asset from Cloudinary (safe if publicId missing). */
export async function deleteReportPdfFromCloudinary(publicId) {
    if (!publicId || typeof publicId !== "string") return;
    try {
        await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
    } catch (e) {
        console.warn("Cloudinary destroy failed:", e.message);
    }
}

/**
 * Build a time-limited signed HTTPS URL for a raw PDF.
 * Unsigned `secure_url` often returns 401/404 when delivery is restricted; always sign for server fetches.
 */
export function getSignedRawReportUrl(publicId) {
    if (!publicId || typeof publicId !== "string") {
        throw new Error("Missing Cloudinary public_id for report");
    }
    return cloudinary.url(publicId, {
        resource_type: "raw",
        secure: true,
        sign_url: true,
    });
}

/** Fetch PDF bytes using public_id (signed URL under the hood). */
export async function fetchReportPdfFromCloudinary(publicId) {
    const url = getSignedRawReportUrl(publicId);
    const res = await fetch(url, {
        headers: {
            Accept: "application/pdf,*/*",
            "User-Agent": "EBA-IoT-Backend/1.0",
        },
        redirect: "follow",
        signal:
            typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
                ? AbortSignal.timeout(45_000)
                : undefined,
    });
    if (!res.ok) {
        const ct = res.headers.get("content-type") || "";
        const snippet = (await res.text()).slice(0, 200);
        throw new Error(`Cloudinary fetch HTTP ${res.status} (${ct}) ${snippet}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 4 && buf.subarray(0, 4).toString() !== "%PDF") {
        console.warn("Cloudinary response may not be a PDF (missing %PDF header), length:", buf.length);
    }
    return buf;
}
