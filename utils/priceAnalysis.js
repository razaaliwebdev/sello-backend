/**
 * Price Analysis and Verification Utility
 * Analyzes listing prices against market data to provide fair price indicators
 */

import Car from '../models/carModel.js';
import Logger from '../utils/logger.js';

/**
 * Calculate market statistics for similar cars
 * @param {Object} carData - Car data to analyze
 * @returns {Promise<Object>} Market statistics
 */
export const calculateMarketPrice = async (carData) => {
    try {
        const { make, model, year, condition, mileage, city, regionalSpec } = carData;

        // Build query for similar cars (sold or active)
        const similarCarsQuery = {
            make: make,
            model: model,
            year: year,
            condition: condition,
            status: { $ne: 'deleted' },
            // Mileage within 20% range
            mileage: {
                $gte: mileage * 0.8,
                $lte: mileage * 1.2
            }
        };

        // Add regional spec filter if available
        if (regionalSpec) {
            similarCarsQuery.regionalSpec = regionalSpec;
        }

        // Get similar cars from database
        const similarCars = await Car.find(similarCarsQuery)
            .select('price mileage year condition city status')
            .lean();

        if (similarCars.length === 0) {
            return {
                fairPriceRange: null,
                marketAverage: null,
                priceIndicator: 'insufficient_data',
                similarListingsCount: 0,
                message: 'Not enough market data to determine fair price'
            };
        }

        // Filter to similar mileage range (within 30% for better matching)
        const mileageFiltered = similarCars.filter(car => {
            const mileageDiff = Math.abs(car.mileage - mileage) / mileage;
            return mileageDiff <= 0.3;
        });

        const carsToAnalyze = mileageFiltered.length >= 3 ? mileageFiltered : similarCars;

        // Calculate statistics
        const prices = carsToAnalyze.map(car => car.price).filter(p => p > 0);
        
        if (prices.length === 0) {
            return {
                fairPriceRange: null,
                marketAverage: null,
                priceIndicator: 'insufficient_data',
                similarListingsCount: 0
            };
        }

        // Sort prices
        prices.sort((a, b) => a - b);

        // Calculate percentiles
        const median = prices[Math.floor(prices.length / 2)];
        const q1Index = Math.floor(prices.length * 0.25);
        const q3Index = Math.floor(prices.length * 0.75);
        const q1 = prices[q1Index];
        const q3 = prices[q3Index];

        // Calculate average
        const average = prices.reduce((sum, p) => sum + p, 0) / prices.length;

        // Fair price range (25th to 75th percentile)
        const fairPriceRange = {
            low: q1,
            high: q3,
            median: median,
            average: Math.round(average)
        };

        return {
            fairPriceRange,
            marketAverage: Math.round(average),
            median: median,
            similarListingsCount: carsToAnalyze.length,
            priceRange: {
                min: prices[0],
                max: prices[prices.length - 1]
            }
        };
    } catch (error) {
        Logger.error('Error calculating market price', error);
        return {
            fairPriceRange: null,
            marketAverage: null,
            priceIndicator: 'error',
            similarListingsCount: 0,
            error: error.message
        };
    }
};

/**
 * Analyze if a price is fair compared to market
 * @param {Number} listingPrice - Price of the listing
 * @param {Object} marketData - Market data from calculateMarketPrice
 * @returns {Object} Price analysis result
 */
export const analyzePriceFairness = (listingPrice, marketData) => {
    if (!marketData.fairPriceRange || !marketData.fairPriceRange.low) {
        return {
            indicator: 'insufficient_data',
            message: 'Not enough market data for comparison',
            deviation: null
        };
    }

    const { fairPriceRange, marketAverage } = marketData;
    const { low, high, median } = fairPriceRange;

    let indicator;
    let message;
    let deviation;

    if (listingPrice < low) {
        indicator = 'below_market';
        deviation = ((low - listingPrice) / low * 100).toFixed(1);
        message = `Price is ${deviation}% below market range (${low.toLocaleString()} - ${high.toLocaleString()})`;
    } else if (listingPrice > high) {
        indicator = 'above_market';
        deviation = ((listingPrice - high) / high * 100).toFixed(1);
        message = `Price is ${deviation}% above market range (${low.toLocaleString()} - ${high.toLocaleString()})`;
    } else {
        indicator = 'fair';
        deviation = 0;
        message = `Price is within fair market range (${low.toLocaleString()} - ${high.toLocaleString()})`;
    }

    // Compare to average
    const avgDeviation = marketAverage ? ((listingPrice - marketAverage) / marketAverage * 100).toFixed(1) : null;

    return {
        indicator, // 'fair', 'below_market', 'above_market', 'insufficient_data'
        message,
        deviation: parseFloat(deviation),
        averageDeviation: avgDeviation ? parseFloat(avgDeviation) : null,
        marketData
    };
};

/**
 * Get price analysis for a car listing
 * @param {Object} car - Car document or car data
 * @returns {Promise<Object>} Complete price analysis
 */
export const getPriceAnalysis = async (car) => {
    try {
        const carData = {
            make: car.make,
            model: car.model,
            year: car.year,
            condition: car.condition,
            mileage: car.mileage || 0,
            city: car.city,
            regionalSpec: car.regionalSpec
        };

        const marketData = await calculateMarketPrice(carData);
        const priceAnalysis = analyzePriceFairness(car.price, marketData);

        return {
            listingPrice: car.price,
            ...priceAnalysis,
            marketData
        };
    } catch (error) {
        Logger.error('Error getting price analysis', error);
        return {
            listingPrice: car.price,
            indicator: 'error',
            message: 'Error analyzing price',
            error: error.message
        };
    }
};
