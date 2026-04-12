// services/reportStorage.js — durable PDF storage for serverless (Cloudinary raw upload)
import cloudinary from "../config/cloudinary.js";

export function isCloudinaryReportStorageEnabled() {
    return Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );
}

const toHttps = (u) => (typeof u === "string" ? u.replace(/^http:\/\//i, "https://") : u);

/** Recover public_id from an unsigned delivery URL when older DB rows omitted `cloudinaryPublicId`. */
export function inferRawPublicIdFromCloudinaryUrl(url) {
    if (!url || typeof url !== "string") return null;
    const s = toHttps(url).trim();
    const m = s.match(/\/raw\/upload\/v\d+\/(.+?)(?:\?|$)/i) || s.match(/\/raw\/upload\/(.+?)(?:\?|$)/i);
    if (!m) return null;
    try {
        return decodeURIComponent(m[1]);
    } catch {
        return m[1];
    }
}

const resolveRawPublicId = (report) =>
    report.cloudinaryPublicId || inferRawPublicIdFromCloudinaryUrl(report.pdfFileUrl || report.cloudinarySecureUrl);

/**
 * Upload a generated PDF from disk to Cloudinary as a raw asset, then caller should unlink the local file.
 * Uses public access_mode so the returned HTTPS link works in browsers and for simple GET fetches.
 * @returns {{ publicId: string, secureUrl: string, pdfFileUrl: string, bytes: number }}
 */
export async function uploadReportPdfToCloudinary(localPdfPath) {
    const folder = (process.env.CLOUDINARY_REPORT_FOLDER || "eba_iot_reports").replace(/^\/+|\/+$/g, "");

    const baseOpts = {
        resource_type: "raw",
        type: "upload",
        folder,
        use_filename: true,
        unique_filename: true,
        overwrite: false,
    };

    let result;
    try {
        result = await cloudinary.uploader.upload(localPdfPath, {
            ...baseOpts,
            access_mode: "public",
        });
    } catch (e) {
        // Some product tiers reject access_mode on raw; retry without it (default delivery rules apply).
        console.warn("Cloudinary upload with access_mode=public failed, retrying:", e.message);
        result = await cloudinary.uploader.upload(localPdfPath, baseOpts);
    }

    const secureUrl = toHttps(result.secure_url || result.url);
    if (!secureUrl || !result.public_id) {
        throw new Error("Cloudinary upload response missing secure_url or public_id");
    }

    const version = result.version != null ? Number(result.version) : undefined;

    return {
        publicId: result.public_id,
        secureUrl,
        pdfFileUrl: secureUrl,
        version: Number.isFinite(version) ? version : undefined,
        bytes: Number(result.bytes) || Number(result.size) || 0,
    };
}

/**
 * Remove raw asset from Cloudinary.
 * @param {string|object} reportOrPublicId — `public_id` string, or a report-like object with `cloudinaryPublicId` / URLs.
 */
export async function deleteReportPdfFromCloudinary(reportOrPublicId) {
    const publicId =
        typeof reportOrPublicId === "string"
            ? reportOrPublicId
            : resolveRawPublicId(reportOrPublicId);
    if (!publicId || typeof publicId !== "string") return;
    try {
        await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
    } catch (e) {
        console.warn("Cloudinary destroy failed:", e.message);
    }
}

const signedRawOpts = (report, extra = {}) => {
    const opts = {
        resource_type: "raw",
        type: "upload",
        secure: true,
        sign_url: true,
        ...extra,
    };
    const ver = Number(report.cloudinaryVersion);
    // Version must match the asset tied to `cloudinaryPublicId`. Omit when we only inferred public_id from a URL.
    if (report.cloudinaryPublicId && report.cloudinaryVersion != null && Number.isFinite(ver) && ver > 0) {
        opts.version = ver;
    }
    return opts;
};

/**
 * Signed HTTPS URL for inline viewing.
 * Never redirect to unsigned `secure_url` — many accounts return 401 without a signature.
 */
export function getCloudinaryViewRedirectUrl(report) {
    const publicId = resolveRawPublicId(report);
    if (!publicId) {
        throw new Error(
            "Cannot build a signed Cloudinary URL (missing public_id and no inferable URL). Regenerate this report."
        );
    }
    return cloudinary.url(publicId, signedRawOpts(report));
}

/** Signed URL that prompts download with a sensible filename (Cloudinary `fl_attachment`). */
export function getCloudinaryDownloadRedirectUrl(report) {
    const rawName = report.originalFilename || "report.pdf";
    const safeName = rawName.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "report.pdf";

    const publicId = resolveRawPublicId(report);
    if (!publicId) {
        throw new Error(
            "Cannot build a signed Cloudinary URL (missing public_id and no inferable URL). Regenerate this report."
        );
    }
    return cloudinary.url(publicId, signedRawOpts(report, { flags: `attachment:${safeName}` }));
}
