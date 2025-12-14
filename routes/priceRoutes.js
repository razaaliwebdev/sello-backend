import express from 'express';
import { auth } from '../middlewares/authMiddleware.js';
import Car from '../models/carModel.js';
import { getPriceAnalysis, calculateMarketPrice } from '../utils/priceAnalysis.js';

const router = express.Router();

/**
 * Get price analysis for a specific car
 * GET /api/price/analysis/:carId
 */
router.get('/analysis/:carId', async (req, res) => {
    try {
        const { carId } = req.params;

        const car = await Car.findById(carId);
        if (!car) {
            return res.status(404).json({
                success: false,
                message: 'Car not found'
            });
        }

        const priceAnalysis = await getPriceAnalysis(car);

        return res.status(200).json({
            success: true,
            data: priceAnalysis
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error analyzing price',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * Get market price for car criteria
 * POST /api/price/market
 * Body: { make, model, year, condition, mileage, city, regionalSpec }
 */
router.post('/market', async (req, res) => {
    try {
        const { make, model, year, condition, mileage, city, regionalSpec } = req.body;

        if (!make || !model || !year || !condition) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: make, model, year, condition'
            });
        }

        const marketData = await calculateMarketPrice({
            make,
            model,
            year,
            condition,
            mileage: mileage || 0,
            city,
            regionalSpec
        });

        return res.status(200).json({
            success: true,
            data: marketData
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error calculating market price',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

export default router;
