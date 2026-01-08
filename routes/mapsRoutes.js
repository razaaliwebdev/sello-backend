import express from "express";
import { auth } from "../middlewares/authMiddleware.js";
import rateLimit from "express-rate-limit";

const router = express.Router();

// Rate limiting for Google Maps API calls
const mapsRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many map requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @route   GET /api/maps/geocode
 * @desc    Proxy for Google Maps Geocoding API
 * @access  Public (with rate limiting)
 */
router.get("/geocode", mapsRateLimit, async (req, res) => {
  try {
    const { address } = req.query;

    if (!address) {
      return res.status(400).json({
        success: false,
        message: "Address is required",
      });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: "Google Maps API not configured",
      });
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        address
      )}&key=${apiKey}`
    );

    const data = await response.json();

    if (data.status === "OK") {
      res.json({
        success: true,
        data: {
          results: data.results,
          status: data.status,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        message: data.error_message || "Geocoding failed",
        status: data.status,
      });
    }
  } catch (error) {
    console.error("Geocoding error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

/**
 * @route   GET /api/maps/places
 * @desc    Proxy for Google Places API
 * @access  Public (with rate limiting)
 */
router.get("/places", mapsRateLimit, async (req, res) => {
  try {
    const { query, location, radius = 5000 } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Query is required",
      });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: "Google Maps API not configured",
      });
    }

    let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      query
    )}&key=${apiKey}`;

    if (location) {
      url += `&location=${location}&radius=${radius}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK") {
      res.json({
        success: true,
        data: {
          results: data.results,
          status: data.status,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        message: data.error_message || "Places search failed",
        status: data.status,
      });
    }
  } catch (error) {
    console.error("Places search error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

/**
 * @route   GET /api/maps/distancematrix
 * @desc    Proxy for Google Distance Matrix API
 * @access  Public (with rate limiting)
 */
router.get("/distancematrix", mapsRateLimit, async (req, res) => {
  try {
    const { origins, destinations, mode = "driving" } = req.query;

    if (!origins || !destinations) {
      return res.status(400).json({
        success: false,
        message: "Origins and destinations are required",
      });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: "Google Maps API not configured",
      });
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
        origins
      )}&destinations=${encodeURIComponent(
        destinations
      )}&mode=${mode}&key=${apiKey}`
    );

    const data = await response.json();

    if (data.status === "OK") {
      res.json({
        success: true,
        data: {
          rows: data.rows,
          status: data.status,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        message: data.error_message || "Distance matrix failed",
        status: data.status,
      });
    }
  } catch (error) {
    console.error("Distance matrix error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

/**
 * @route   GET /api/maps/static-map
 * @desc    Proxy for Google Static Maps API
 * @access  Public (with rate limiting)
 */
router.get("/static-map", mapsRateLimit, async (req, res) => {
  try {
    const {
      center,
      zoom = 15,
      size = "600x400",
      maptype = "roadmap",
      markers,
    } = req.query;

    if (!center) {
      return res.status(400).json({
        success: false,
        message: "Center coordinates are required",
      });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: "Google Maps API not configured",
      });
    }

    let url = `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(
      center
    )}&zoom=${zoom}&size=${size}&maptype=${maptype}&key=${apiKey}`;

    if (markers) {
      url += `&markers=${encodeURIComponent(markers)}`;
    }

    // Fetch the image and proxy it
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(400).json({
        success: false,
        message: "Failed to generate static map",
      });
    }

    // Set appropriate headers
    res.set({
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400", // Cache for 24 hours
    });

    // Pipe the image response
    response.body.pipe(res);
  } catch (error) {
    console.error("Static map error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;
