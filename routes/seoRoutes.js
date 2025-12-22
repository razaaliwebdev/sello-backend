/**
 * SEO Routes
 * Handles robots.txt, sitemap.xml, and structured data
 */

import express from 'express';
import Car from '../models/carModel.js';
import Logger from '../utils/logger.js';

const router = express.Router();

/**
 * Generate sitemap.xml
 */
router.get('/sitemap.xml', async (req, res) => {
    try {
        const baseUrl = process.env.FRONTEND_URL || process.env.PRODUCTION_URL || 'https://yourdomain.com';
        
        // Get all active car listings
        const cars = await Car.find({
            status: 'active',
            isApproved: true
        })
        .select('_id updatedAt')
        .lean()
        .limit(50000); // Limit to 50k URLs (sitemap limit)

        // Generate sitemap XML
        let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
    <!-- Homepage -->
    <url>
        <loc>${baseUrl}</loc>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
    <!-- Listings Page -->
    <url>
        <loc>${baseUrl}/cars</loc>
        <changefreq>hourly</changefreq>
        <priority>0.9</priority>
    </url>
    <!-- Car Listings -->
`;

        cars.forEach(car => {
            const lastmod = car.updatedAt ? new Date(car.updatedAt).toISOString() : new Date().toISOString();
            sitemap += `    <url>
        <loc>${baseUrl}/cars/${car._id}</loc>
        <lastmod>${lastmod}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>
`;
        });

        sitemap += `</urlset>`;

        res.set('Content-Type', 'application/xml');
        res.send(sitemap);
    } catch (error) {
        Logger.error('Sitemap generation error', error);
        res.status(500).send('Error generating sitemap');
    }
});

/**
 * Serve robots.txt
 */
router.get('/robots.txt', (req, res) => {
    const baseUrl = process.env.FRONTEND_URL || process.env.PRODUCTION_URL || 'https://yourdomain.com';
    const robots = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /login
Disallow: /sign-up
Disallow: /forgot-password
Disallow: /reset-password
Disallow: /verify-otp

# Sitemap
Sitemap: ${baseUrl}/sitemap.xml
`;
    res.set('Content-Type', 'text/plain');
    res.send(robots);
});

export default router;

