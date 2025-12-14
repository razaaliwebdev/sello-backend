/**
 * Image Quality Validation Utility
 * Validates image quality before upload to ensure good listing quality
 */

/**
 * Validate image quality and dimensions
 * @param {Buffer} imageBuffer - Image buffer
 * @param {Object} options - Validation options
 * @returns {Promise<{valid: boolean, errors: string[], warnings: string[], metadata: object}>}
 */
export const validateImageQuality = async (imageBuffer, options = {}) => {
    const {
        minWidth = 400,
        minHeight = 300,
        maxWidth = 10000,
        maxHeight = 10000,
        minFileSize = 10000, // 10KB minimum
        maxFileSize = 10 * 1024 * 1024, // 10MB maximum
        minAspectRatio = 0.5,
        maxAspectRatio = 3.0
    } = options;

    const errors = [];
    const warnings = [];
    let metadata = {};

    try {
        // Try to use sharp if available, otherwise use basic validation
        let sharp;
        try {
            sharp = (await import('sharp')).default;
        } catch (err) {
            // Sharp not available, use basic validation
            return validateImageBasic(imageBuffer, { minFileSize, maxFileSize });
        }

        // Get image metadata using sharp
        const image = sharp(imageBuffer);
        metadata = await image.metadata();

        // Check file size
        if (imageBuffer.length < minFileSize) {
            errors.push(`Image too small (${(imageBuffer.length / 1024).toFixed(1)}KB). Minimum: ${(minFileSize / 1024).toFixed(1)}KB`);
        }

        if (imageBuffer.length > maxFileSize) {
            errors.push(`Image too large (${(imageBuffer.length / 1024 / 1024).toFixed(1)}MB). Maximum: ${(maxFileSize / 1024 / 1024).toFixed(1)}MB`);
        }

        // Check dimensions
        if (metadata.width && metadata.height) {
            if (metadata.width < minWidth || metadata.height < minHeight) {
                errors.push(`Image dimensions too small (${metadata.width}x${metadata.height}). Minimum: ${minWidth}x${minHeight}`);
            }

            if (metadata.width > maxWidth || metadata.height > maxHeight) {
                warnings.push(`Image dimensions very large (${metadata.width}x${metadata.height}). May take longer to upload.`);
            }

            // Check aspect ratio (too narrow or too wide might be wrong orientation)
            const aspectRatio = metadata.width / metadata.height;
            if (aspectRatio < minAspectRatio || aspectRatio > maxAspectRatio) {
                warnings.push(`Unusual aspect ratio (${aspectRatio.toFixed(2)}). Image may be rotated incorrectly.`);
            }

            // Check if image is too square (might be a thumbnail)
            if (Math.abs(aspectRatio - 1.0) < 0.1 && metadata.width < 800) {
                warnings.push('Image appears to be square and small. Consider using a wider landscape photo.');
            }
        } else {
            warnings.push('Could not determine image dimensions. Image may be corrupted.');
        }

        // Check format
        if (!metadata.format || !['jpeg', 'jpg', 'png', 'webp'].includes(metadata.format.toLowerCase())) {
            errors.push(`Unsupported image format: ${metadata.format || 'unknown'}. Use JPEG, PNG, or WebP.`);
        }

        // Basic quality heuristics
        // Very small file size relative to dimensions might indicate low quality
        if (metadata.width && metadata.height && imageBuffer.length) {
            const pixels = metadata.width * metadata.height;
            const bytesPerPixel = imageBuffer.length / pixels;
            
            if (bytesPerPixel < 0.5) {
                warnings.push('Image may be low quality or heavily compressed.');
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            metadata: {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                size: imageBuffer.length,
                aspectRatio: metadata.width && metadata.height ? (metadata.width / metadata.height).toFixed(2) : null
            }
        };
    } catch (error) {
        // If sharp fails, fall back to basic validation
        return validateImageBasic(imageBuffer, { minFileSize, maxFileSize });
    }
};

/**
 * Basic image validation without sharp (fallback)
 */
const validateImageBasic = (imageBuffer, options = {}) => {
    const {
        minFileSize = 10000,
        maxFileSize = 10 * 1024 * 1024
    } = options;

    const errors = [];
    const warnings = [];

    // Check file size
    if (imageBuffer.length < minFileSize) {
        errors.push(`Image too small (${(imageBuffer.length / 1024).toFixed(1)}KB). Minimum: ${(minFileSize / 1024).toFixed(1)}KB`);
    }

    if (imageBuffer.length > maxFileSize) {
        errors.push(`Image too large (${(imageBuffer.length / 1024 / 1024).toFixed(1)}MB). Maximum: ${(maxFileSize / 1024 / 1024).toFixed(1)}MB`);
    }

    // Basic magic number check for image formats
    const header = imageBuffer.slice(0, 4);
    const isJPEG = header[0] === 0xFF && header[1] === 0xD8;
    const isPNG = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47;
    const isWebP = header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46;

    if (!isJPEG && !isPNG && !isWebP) {
        errors.push('Invalid image format. Use JPEG, PNG, or WebP.');
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        metadata: {
            size: imageBuffer.length,
            format: isJPEG ? 'jpeg' : isPNG ? 'png' : isWebP ? 'webp' : 'unknown'
        }
    };
};

/**
 * Validate multiple images and return aggregate results
 */
export const validateMultipleImages = async (imageBuffers, options = {}) => {
    const results = await Promise.all(
        imageBuffers.map(buffer => validateImageQuality(buffer, options))
    );

    const allErrors = [];
    const allWarnings = [];
    let allValid = true;

    results.forEach((result, index) => {
        if (!result.valid) {
            allValid = false;
        }
        if (result.errors.length > 0) {
            allErrors.push(`Image ${index + 1}: ${result.errors.join(', ')}`);
        }
        if (result.warnings.length > 0) {
            allWarnings.push(`Image ${index + 1}: ${result.warnings.join(', ')}`);
        }
    });

    return {
        valid: allValid,
        errors: allErrors,
        warnings: allWarnings,
        results: results
    };
};
