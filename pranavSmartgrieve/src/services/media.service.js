/**
 * MEDIA SERVICE — The Black Box
 * 
 * Non-blocking, fault-tolerant media ingestion pipeline.
 * Downloads WhatsApp images, uploads to Cloudinary, extracts EXIF GPS.
 * 
 * EVERY function is wrapped in try/catch. The pipeline NEVER throws.
 * If any step fails, it returns safe defaults and the complaint continues.
 * 
 * Max 3 images per complaint. Additional images are ignored.
 */

require('dotenv').config();
const axios = require('axios');
const cloudinary = require('cloudinary').v2;

// ─── Cloudinary Configuration ──────────────────────────────────────
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const MAX_IMAGES_PER_COMPLAINT = 3;

/**
 * 1. Fetch the temporary download URL from Meta Graph API.
 * 
 * @param {string} mediaId - The WhatsApp media_id from the webhook payload
 * @returns {string|null} The temporary download URL, or null on failure
 */
async function fetchMetaMediaUrl(mediaId) {
    try {
        const response = await axios.get(
            `https://graph.facebook.com/${process.env.VERSION}/${mediaId}`,
            {
                headers: { 
                    'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                }
            }
        );
        return response.data?.url || null;
    } catch (err) {
        console.warn(`📷 [MEDIA] Header auth failed for ${mediaId}, trying query param auth...`);
        try {
            const response = await axios.get(
                `https://graph.facebook.com/${process.env.VERSION}/${mediaId}?access_token=${process.env.WHATSAPP_TOKEN}`,
                {
                    headers: { 
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                    }
                }
            );
            return response.data?.url || null;
        } catch (err2) {
            console.error(`📷 [MEDIA] Failed to fetch Meta media URL for ${mediaId}:`, err2.response?.data || err2.message);
            return null;
        }
    }
}

/**
 * 2. Download the image as a buffer from the temporary URL.
 * 
 * @param {string} url - The temporary download URL from Meta
 * @returns {Buffer|null} The image buffer, or null on failure
 */
async function downloadMedia(url) {
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: { 
                'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });
        return Buffer.from(response.data);
    } catch (err) {
        console.warn('📷 [MEDIA] Download with auth header failed, trying without auth header...');
        try {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                }
            });
            return Buffer.from(response.data);
        } catch (err2) {
            let errorMsg = err2.message;
            if (err2.response && err2.response.data) {
                try {
                    // Axios returns error data as arraybuffer if responseType is arraybuffer
                    errorMsg = JSON.parse(err2.response.data.toString('utf8')).error.message;
                } catch (e) {
                    errorMsg = err2.response.data.toString('utf8');
                }
            }
            console.error('📷 [MEDIA] Failed to download image:', errorMsg);
            return null;
        }
    }
}

/**
 * 3. Extract EXIF metadata (especially GPS) from image buffer.
 * Uses dynamic import for exifr (ESM module).
 * 
 * ⚠️ EXIF may not exist (especially from WhatsApp compression).
 * This function NEVER throws or blocks execution.
 * 
 * @param {Buffer} buffer - The image buffer
 * @returns {Object} { lat, lng, available }
 */
async function extractExif(buffer) {
    const noExif = { lat: null, lng: null, available: false };
    try {
        const exifr = await import('exifr');
        const gps = await exifr.gps(buffer);
        
        if (gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number') {
            console.log(`📷 [MEDIA] EXIF GPS found: [${gps.latitude}, ${gps.longitude}]`);
            return { lat: gps.latitude, lng: gps.longitude, available: true };
        }
        
        return noExif;
    } catch (err) {
        // EXIF extraction failure is expected and non-blocking
        return noExif;
    }
}

/**
 * 4. Upload buffer to Cloudinary via stream.
 * 
 * @param {Buffer} buffer - The file buffer
 * @param {string} ticketId - Public ID prefix
 * @param {string} resourceType - 'image' or 'video'
 * @returns {Object|null} Upload result or null
 */
async function uploadToCloudinary(buffer, ticketId, resourceType = 'image') {
    try {
        const result = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'grievances',
                    public_id: `${ticketId}_${Date.now()}`,
                    resource_type: resourceType
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            uploadStream.end(buffer);
        });

        console.log(`📷 [MEDIA] Uploaded ${resourceType} to Cloudinary: ${result.secure_url}`);
        return {
            secure_url: result.secure_url,
            public_id: result.public_id,
            metadata: {
                format: result.format,
                width: result.width,
                height: result.height,
                duration: result.duration || null
            }
        };
    } catch (err) {
        console.error(`📷 [MEDIA] Cloudinary ${resourceType} upload failed:`, err.message);
        return null;
    }
}

/**
 * 5. ORCHESTRATOR — Process a single WhatsApp image end-to-end.
 * 
 * This is the public-facing function called by the controller.
 * It coordinates all 4 steps and returns a unified result.
 * 
 * @param {string} mediaId - The WhatsApp media_id
 * @param {string} ticketId - The grievance ticket ID
 * @returns {Object} Always returns a valid object, never throws
 */
async function processWhatsAppImage(mediaId, ticketId) {
    const safeResult = {
        image_url: null,
        public_id: null,
        image_metadata: { format: null, width: null, height: null },
        exif: { lat: null, lng: null, available: false },
        buffer: null  // Kept temporarily for Gemini Vision, NOT persisted to DB
    };

    try {
        // Step 1: Fetch temporary URL
        const mediaUrl = await fetchMetaMediaUrl(mediaId);
        if (!mediaUrl) return safeResult;

        // Step 2: Download buffer
        const buffer = await downloadMedia(mediaUrl);
        if (!buffer) return safeResult;

        // Step 3 & 4: Run EXIF extraction and Cloudinary upload IN PARALLEL
        const [exifResult, cloudResult] = await Promise.all([
            extractExif(buffer),
            uploadToCloudinary(buffer, ticketId)
        ]);

        return {
            image_url: cloudResult?.secure_url || null,
            public_id: cloudResult?.public_id || null,
            image_metadata: cloudResult?.metadata || safeResult.image_metadata,
            exif: exifResult,
            buffer  // Passed to Intelligence Agent for Gemini Vision
        };
    } catch (err) {
        console.error('📷 [MEDIA] processWhatsAppImage failed:', err.message);
        return safeResult;
    }
}

/**
 * 6. Process a single WhatsApp audio message (voice note).
... (existing content)
 */
async function processWhatsAppAudio(mediaId) {
    const safeResult = {
        buffer: null,
        mimeType: 'audio/ogg'
    };

    try {
        const mediaUrl = await module.exports.fetchMetaMediaUrl(mediaId);
        if (!mediaUrl) return safeResult;

        const buffer = await module.exports.downloadMedia(mediaUrl);
        if (!buffer) return safeResult;

        return {
            buffer,
            mimeType: 'audio/ogg'
        };
    } catch (err) {
        console.error('🎤 [MEDIA] processWhatsAppAudio failed:', err.message);
        return safeResult;
    }
}

/**
 * 7. Process a single WhatsApp video message.
 * 
 * @param {string} mediaId - The WhatsApp media_id
 * @param {string} ticketId - The grievance ticket ID
 * @returns {Object} { video_url, public_id, metadata }
 */
async function processWhatsAppVideo(mediaId, ticketId) {
    const safeResult = {
        type: 'video',
        video_url: null,
        public_id: null,
        metadata: { format: null, width: null, height: null, duration: null }
    };

    try {
        const mediaUrl = await fetchMetaMediaUrl(mediaId);
        if (!mediaUrl) return safeResult;

        const buffer = await downloadMedia(mediaUrl);
        if (!buffer) return safeResult;

        const cloudResult = await uploadToCloudinary(buffer, ticketId, 'video');

        return {
            type: 'video',
            video_url: cloudResult?.secure_url || null,
            public_id: cloudResult?.public_id || null,
            metadata: cloudResult?.metadata || safeResult.metadata
        };
    } catch (err) {
        console.error('🎬 [MEDIA] processWhatsAppVideo failed:', err.message);
        return safeResult;
    }
}

module.exports = {
    fetchMetaMediaUrl,
    downloadMedia,
    extractExif,
    uploadToCloudinary,
    processWhatsAppImage,
    processWhatsAppAudio,
    processWhatsAppVideo,
    MAX_IMAGES_PER_COMPLAINT
};
