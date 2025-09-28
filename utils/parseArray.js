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

    // General search by title (case-insensitive)
    if (query.search) {
        if (typeof query.search !== 'string' || query.search.trim() === '') {
            throw new Error('Invalid search parameter');
        }
        filter.title = { $regex: query.search.trim(), $options: 'i' };
    }

    // Text search with case-insensitive matching
    const textFilters = ['make', 'model', 'city', 'variant', 'description', 'location'];
    textFilters.forEach(field => {
        if (query[field]) {
            if (typeof query[field] !== 'string' || query[field].trim() === '') {
                throw new Error(`Invalid ${field} parameter`);
            }
            filter[field] = { $regex: query[field].trim(), $options: 'i' };
        }
    });

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

    // Engine capacity range (map enum to numeric ranges)
    const engineRanges = {
        "0-999 CC": { min: 0, max: 999 },
        "1000-1499 CC": { min: 1000, max: 1499 },
        "1500-1999 CC": { min: 1500, max: 1999 },
        "2000-2499 CC": { min: 2000, max: 2499 },
        "2500+ CC": { min: 2500, max: Infinity }
    };

    if (query.engineMin || query.engineMax) {
        const engineMin = query.engineMin ? Number(query.engineMin) : 0;
        const engineMax = query.engineMax ? Number(query.engineMax) : Infinity;
        if (isNaN(engineMin) || isNaN(engineMax)) {
            throw new Error('Invalid engine capacity range');
        }
        const possibleCapacities = [];
        for (const [key, { min, max }] of Object.entries(engineRanges)) {
            if (engineMin <= max && engineMax >= min) {
                possibleCapacities.push(key);
            }
        }
        if (possibleCapacities.length > 0) {
            filter.engineCapacity = { $in: possibleCapacities };
        } else {
            filter.engineCapacity = { $exists: false }; // No matches
        }
    }

    // Horsepower range (use $in with generated string values)
    if (query.hpMin || query.hpMax) {
        const hpMin = query.hpMin ? Number(query.hpMin) : 0;
        const hpMax = query.hpMax ? Number(query.hpMax) : Infinity;
        if (isNaN(hpMin) || isNaN(hpMax)) {
            throw new Error('Invalid horsepower range');
        }
        // Cap range to prevent performance issues (e.g., max 1000 values)
        if (hpMax - hpMin > 1000) {
            throw new Error('Horsepower range too large (max 1000)');
        }
        const hpValues = [];
        for (let i = Math.max(0, Math.floor(hpMin)); i <= Math.min(hpMax, 10000); i++) {
            hpValues.push(`${i} HP`);
        }
        filter.horsepower = { $in: hpValues, $ne: "N/A" };
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

    return filter;
};