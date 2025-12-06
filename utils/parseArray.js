// utils/parseArray.js (Unchanged)
export const parseArray = (val) => {
    if (!val) return [];
    return Array.isArray(val) ? val : val.split(',').filter(Boolean);
};

// Builds a MongoDB query object from query parameters (Updated)
export const buildCarQuery = (query) => {
    const filter = {};

    // Validate query is an object
    if (!query || typeof query !== 'object') {
        throw new Error('Invalid query parameters');
    }

    // Keyword/text search - search across multiple fields
    if (query.search || query.keyword || query.q) {
        const searchTerm = (query.search || query.keyword || query.q).trim();
        if (searchTerm) {
            // Use $or to search across multiple fields for better results
            filter.$or = [
                { title: { $regex: searchTerm, $options: 'i' } },
                { make: { $regex: searchTerm, $options: 'i' } },
                { model: { $regex: searchTerm, $options: 'i' } },
                { description: { $regex: searchTerm, $options: 'i' } },
                { city: { $regex: searchTerm, $options: 'i' } },
                { location: { $regex: searchTerm, $options: 'i' } }
            ];
        }
    }

    // Text search with case-insensitive matching (only if not using keyword search)
    if (!query.search && !query.keyword && !query.q) {
    const textFilters = ['make', 'model', 'city', 'variant', 'description', 'location'];
    textFilters.forEach(field => {
        if (query[field]) {
            if (typeof query[field] !== 'string' || query[field].trim() === '') {
                throw new Error(`Invalid ${field} parameter`);
            }
            filter[field] = { $regex: query[field].trim(), $options: 'i' };
        }
    });
    }

    // Enum validation for single-value fields
    const enumFields = {
        condition: ["New", "Used"],
        fuelType: ["Petrol", "Diesel", "Hybrid", "Electric"],
        transmission: ["Manual", "Automatic"],
        regionalSpec: ["GCC", "American", "Canadian", "European"],
        bodyType: [
            "Roadster", "Cabriolet", "Super", "Hatchback", "Micro", "Station", "Sedan",
            "Muscle", "Sports", "Targa", "Convertible", "Coupe", "Hybrid", "SUV", "Pickup", "Van"
        ],
        sellerType: ["individual", "dealer"],
        ownerType: ["Owner", "Dealer", "Dealership"],
        warranty: ["Yes", "No", "Doesn't Apply"]
    };

    Object.keys(enumFields).forEach(field => {
        if (query[field]) {
            const values = parseArray(query[field]);
            if (values.length > 0) {
                if (!values.every(val => enumFields[field].includes(val))) {
                    throw new Error(`Invalid ${field} value(s). Must be one of: ${enumFields[field].join(', ')}`);
                }
                filter[field] = values.length === 1 ? values[0] : { $in: values };
            }
        }
    });

    // Multi-select for array fields (features uses $all)
    const arrayFilters = ['features', 'colorExterior', 'colorInterior'];
    arrayFilters.forEach(field => {
        if (query[field]) {
            const values = parseArray(query[field]);
            if (values.length > 0) {
                if (field === 'features') {
                    filter[field] = { $all: values }; // Must have ALL features
                } else {
                    filter[field] = { $in: values }; // OR for colors
                }
            }
        }
    });

    // Engine capacity range (numeric)
    if (query.engineMin || query.engineMax) {
        const engineMin = query.engineMin ? Number(query.engineMin) : 0;
        const engineMax = query.engineMax ? Number(query.engineMax) : Infinity;
        
        if (!isNaN(engineMin) || !isNaN(engineMax)) {
            filter.engineCapacity = {};
            if (!isNaN(engineMin)) filter.engineCapacity.$gte = engineMin;
            if (!isNaN(engineMax) && engineMax !== Infinity) filter.engineCapacity.$lte = engineMax;
        }
    }

    // Horsepower range (numeric)
    if (query.hpMin || query.hpMax) {
        const hpMin = query.hpMin ? Number(query.hpMin) : 0;
        const hpMax = query.hpMax ? Number(query.hpMax) : Infinity;
        
        if (!isNaN(hpMin) || !isNaN(hpMax)) {
            filter.horsepower = {};
            if (!isNaN(hpMin)) filter.horsepower.$gte = hpMin;
            if (!isNaN(hpMax) && hpMax !== Infinity) filter.horsepower.$lte = hpMax;
        }
    }

    // Numeric range filters
    const rangeFilters = [
        { queryMin: 'priceMin', queryMax: 'priceMax', field: 'price' },
        { queryMin: 'yearMin', queryMax: 'yearMax', field: 'year' },
        { queryMin: 'mileageMin', queryMax: 'mileageMax', field: 'mileage' },
        { queryMin: 'doorsMin', queryMax: 'doorsMax', field: 'carDoors' },
        { queryMin: 'cylMin', queryMax: 'cylMax', field: 'numberOfCylinders' }
    ];

    rangeFilters.forEach(({ queryMin, queryMax, field }) => {
        const min = query[queryMin] ? Number(query[queryMin]) : null;
        const max = query[queryMax] ? Number(query[queryMax]) : null;

        if (min !== null || max !== null) {
            filter[field] = filter[field] || {};
            if (min !== null) {
                if (isNaN(min)) throw new Error(`Invalid ${queryMin} value`);
                filter[field].$gte = min;
            }
            if (max !== null) {
                if (isNaN(max)) throw new Error(`Invalid ${queryMax} value`);
                filter[field].$lte = max;
            }
        }
    });

    // Location radius filter - return separately as it requires geospatial query
    const locationFilter = {};
    if (query.radius && query.userLat && query.userLng) {
        const radius = Number(query.radius);
        const userLat = Number(query.userLat);
        const userLng = Number(query.userLng);

        if (!isNaN(radius) && !isNaN(userLat) && !isNaN(userLng) && radius > 0) {
            // Validate coordinates
            if (userLat >= -90 && userLat <= 90 && userLng >= -180 && userLng <= 180) {
                locationFilter.radius = radius; // in kilometers
                locationFilter.userLocation = {
                    type: 'Point',
                    coordinates: [userLng, userLat] // MongoDB format: [longitude, latitude]
                };
            }
        }
    }

    return { filter, locationFilter };
};