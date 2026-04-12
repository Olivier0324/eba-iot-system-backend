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

/** Fetch PDF bytes from a stored Cloudinary HTTPS URL (public raw delivery). */
export async function fetchReportPdfBuffer(secureUrl) {
    const res = await fetch(secureUrl, {
        headers: { Accept: "application/pdf" },
        signal:
            typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
                ? AbortSignal.timeout(45_000)
                : undefined,
    });
    if (!res.ok) {
        throw new Error(`Failed to fetch report from storage (${res.status})`);
    }
    return Buffer.from(await res.arrayBuffer());
}
