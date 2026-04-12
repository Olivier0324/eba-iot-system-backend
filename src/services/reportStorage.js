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

/**
 * Upload a generated PDF from disk to Cloudinary as a raw asset, then caller should unlink the local file.
 * Uses public access_mode so the returned HTTPS link works in browsers and for simple GET fetches.
 * @returns {{ publicId: string, secureUrl: string, pdfFileUrl: string, bytes: number }}
 */
export async function uploadReportPdfToCloudinary(localPdfPath) {
    const folder = (process.env.CLOUDINARY_REPORT_FOLDER || "eba_iot_reports").replace(/^\/+|\/+$/g, "");

    const baseOpts = {
        resource_type: "raw",
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

    return {
        publicId: result.public_id,
        secureUrl,
        pdfFileUrl: secureUrl,
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

async function fetchPdfFromUrl(url) {
    const fetchInit = {
        method: "GET",
        headers: {
            Accept: "application/pdf,application/octet-stream,*/*",
            "User-Agent": "EBA-IoT-Backend/1.0",
        },
        redirect: "follow",
    };
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
        fetchInit.signal = AbortSignal.timeout(45_000);
    }

    const res = await fetch(url, fetchInit);
    if (!res.ok) {
        const t = (await res.text()).slice(0, 180);
        throw new Error(`HTTP ${res.status}: ${t}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const head = buf.subarray(0, Math.min(32, buf.length)).toString();
    if (head.trimStart().startsWith("<")) {
        throw new Error("Response is HTML, not a PDF");
    }
    if (buf.length < 100) {
        throw new Error("Response too small to be a PDF");
    }
    return buf;
}

async function fetchPdfFromSignedPublicId(publicId) {
    const url = getSignedRawReportUrl(publicId);
    return await fetchPdfFromUrl(url);
}

/**
 * Load PDF bytes for a Cloudinary-backed report.
 * 1) Try stored link(s) from DB (`pdfFileUrl`, then `cloudinarySecureUrl`) — what Cloudinary returned at upload.
 * 2) Fall back to signed URL built from `cloudinaryPublicId`.
 */
export async function fetchReportPdfBuffer(report) {
    const urlCandidates = [
        report.pdfFileUrl,
        report.cloudinarySecureUrl,
    ]
        .filter((u) => typeof u === "string" && u.length > 10)
        .map(toHttps);

    const tried = [];
    for (const url of [...new Set(urlCandidates)]) {
        try {
            return await fetchPdfFromUrl(url);
        } catch (e) {
            tried.push(`${url.slice(0, 64)}… -> ${e.message}`);
        }
    }

    if (report.cloudinaryPublicId) {
        try {
            return await fetchPdfFromSignedPublicId(report.cloudinaryPublicId);
        } catch (e) {
            tried.push(`signed:${report.cloudinaryPublicId} -> ${e.message}`);
        }
    }

    throw new Error(tried.length ? tried.join(" | ") : "No Cloudinary URL or public_id on report");
}
