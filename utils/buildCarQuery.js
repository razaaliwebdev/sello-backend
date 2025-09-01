// utils/parseArray.js
const parseArray = (val) => {
    if (!val) return [];
    return Array.isArray(val) ? val : val.split(',').filter(Boolean);
};

// Builds a MongoDB query object from query parameters
export const buildCarQuery = (query) => {
    const filter = {};

    // Text search with case-insensitive matching
    if (query.make) filter.make = { $regex: query.make, $options: 'i' };
    if (query.model) filter.model = { $regex: query.model, $options: 'i' };
    if (query.city) filter.city = { $regex: query.city, $options: 'i' };

    // Handle multi-select filters
    const arrayFilters = [
        'sellerType', 'transmission', 'fuelType',
        'features', 'colorExterior', 'colorInterior', 'bodyType',
        'regionalSpec', 'ownerType', 'warranty'
    ];
    
    // Handle condition separately since it's a single value
    if (query.condition) {
        filter.condition = query.condition;
    }

    arrayFilters.forEach(field => {
        if (query[field]) {
            const values = parseArray(query[field]);
            if (values.length > 0) {
                filter[field] = { $in: values };
            }
        }
    });

    // Handle numeric range filters
    const rangeFilters = [
        { queryMin: 'priceMin', queryMax: 'priceMax', field: 'price' },
        { queryMin: 'yearMin', queryMax: 'yearMax', field: 'year' },
        { queryMin: 'mileageMin', queryMax: 'mileageMax', field: 'mileage' },
        { queryMin: 'hpMin', queryMax: 'hpMax', field: 'horsepower' },
        { queryMin: 'engineMin', queryMax: 'engineMax', field: 'engineCapacity' }
    ];

    rangeFilters.forEach(({ queryMin, queryMax, field }) => {
        const min = query[queryMin] ? Number(query[queryMin]) : null;
        const max = query[queryMax] ? Number(query[queryMax]) : null;

        if (min !== null || max !== null) {
            filter[field] = filter[field] || {};
            if (min !== null) filter[field].$gte = min;
            if (max !== null) filter[field].$lte = max;
        }
    });

    // Handle single value number filters
    // Single value number filters
    const numberFilters = ['carDoors', 'seats'];
    numberFilters.forEach(field => {
        if (query[field]) {
            const value = Number(query[field]);
            if (!isNaN(value)) {
                filter[field] = value;
            }
        }
    });

    return filter;
};
