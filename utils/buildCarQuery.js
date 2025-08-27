// utils/parseArray.js
const parseArray = (val) => Array.isArray(val) ? val : val.split(",");

// Builds a MongoDB query object from query parameters
export const buildCarQuery = (query) => {
    const filter = {};

    // Exact match / multi-select filters
    if (query.make) filter.make = query.make;
    if (query.model) filter.model = query.model;
    if (query.condition) filter.condition = { $in: parseArray(query.condition) };
    if (query.sellerType) filter.sellerType = { $in: parseArray(query.sellerType) };
    if (query.transmission) filter.transmission = { $in: parseArray(query.transmission) };
    if (query.fuelType) filter.fuelType = { $in: parseArray(query.fuelType) };
    if (query.city) filter.city = { $regex: query.city, $options: "i" };

    // Range filters
    if (query.priceMin || query.priceMax) {
        filter.price = {};
        if (query.priceMin) filter.price.$gte = Number(query.priceMin);
        if (query.priceMax) filter.price.$lte = Number(query.priceMax);
    }

    if (query.yearMin || query.yearMax) {
        filter.year = {};
        if (query.yearMin) filter.year.$gte = Number(query.yearMin);
        if (query.yearMax) filter.year.$lte = Number(query.yearMax);
    }

    if (query.mileageMin || query.mileageMax) {
        filter.mileage = {};
        if (query.mileageMin) filter.mileage.$gte = Number(query.mileageMin);
        if (query.mileageMax) filter.mileage.$lte = Number(query.mileageMax);
    }

    if (query.hpMin || query.hpMax) {
        filter.horsepower = {};
        if (query.hpMin) filter.horsepower.$gte = Number(query.hpMin);
        if (query.hpMax) filter.horsepower.$lte = Number(query.hpMax);
    }

    if (query.engineMin || query.engineMax) {
        filter.engineCapacity = {};
        if (query.engineMin) filter.engineCapacity.$gte = Number(query.engineMin);
        if (query.engineMax) filter.engineCapacity.$lte = Number(query.engineMax);
    }

    // Multi-select filters
    if (query.features) filter.features = { $in: parseArray(query.features) };
    if (query.colorExterior) filter.colorExterior = { $in: parseArray(query.colorExterior) };
    if (query.colorInterior) filter.colorInterior = { $in: parseArray(query.colorInterior) };
    if (query.doors) filter.carDoors = { $in: parseArray(query.doors).map(Number) };

    return filter;
};
