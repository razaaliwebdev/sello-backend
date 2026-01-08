// utils/parseArray.js - Optimized for FormData arrays
import mongoose from "mongoose";

export const parseArray = (val) => {
  if (!val) return [];

  // If already an array, filter and return
  if (Array.isArray(val)) {
    return val
      .map((item) =>
        typeof item === "string" ? item.trim() : String(item).trim()
      )
      .filter((item) => item && item.length > 0);
  }

  // If string, try to parse as JSON first (for complex arrays)
  if (typeof val === "string") {
    // Try JSON parse first
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) =>
            typeof item === "string" ? item.trim() : String(item).trim()
          )
          .filter((item) => item && item.length > 0);
      }
    } catch {
      // Not JSON, treat as comma-separated
    }

    // Split by comma and clean
    return val
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item && item.length > 0);
  }

  // Fallback: convert to string and split
  return String(val)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item && item.length > 0);
};

// Builds a MongoDB query object from query parameters (Updated)
export const buildCarQuery = (query) => {
  const filter = {};

  // Validate query is an object
  if (!query || typeof query !== "object") {
    throw new Error("Invalid query parameters");
  }

  // Keyword/text search
  let searchTerm = null;
  if (query.search || query.keyword || query.q) {
    searchTerm = (query.search || query.keyword || query.q).trim();
    if (searchTerm && searchTerm.length >= 2) {
      const searchRegex = new RegExp(searchTerm, "i"); // Case-insensitive
      filter.$or = [
        { make: searchRegex },
        { model: searchRegex },
        { variant: searchRegex },
        { title: searchRegex },
        { description: searchRegex },
        { city: searchRegex },
        { location: searchRegex },
      ];
    } else if (searchTerm && searchTerm.length < 2) {
      throw new Error("Search term must be at least 2 characters long");
    }
  }

  // Text search with case-insensitive matching (only if not using keyword search)
  if (!query.search && !query.keyword && !query.q) {
    const textFilters = [
      "make",
      "model",
      "city",
      "variant",
      "description",
      "location",
    ];
    textFilters.forEach((field) => {
      if (query[field]) {
        if (typeof query[field] !== "string" || query[field].trim() === "") {
          throw new Error(`Invalid ${field} parameter`);
        }
        filter[field] = { $regex: query[field].trim(), $options: "i" };
      }
    });
  }

  // Vehicle Type filtering
  if (query.vehicleType) {
    const validVehicleTypes = ["Car", "Bus", "Truck", "Van", "Bike", "E-bike"];
    const vehicleTypes = parseArray(query.vehicleType);
    if (vehicleTypes.length > 0) {
      const validTypes = vehicleTypes.filter((vt) =>
        validVehicleTypes.includes(vt)
      );
      if (validTypes.length > 0) {
        filter.vehicleType = { $in: validTypes };
      }
    }
  }

  // Vehicle Type Category filtering (by category ID)
  if (query.vehicleTypeCategory) {
    if (mongoose.Types.ObjectId.isValid(query.vehicleTypeCategory)) {
      filter.vehicleTypeCategory = new mongoose.Types.ObjectId(
        query.vehicleTypeCategory
      );
    }
  }

  // Featured filter
  if (
    query.featured === "true" ||
    query.featured === true ||
    query.featured === "1"
  ) {
    filter.featured = true;
  }

  // Enum validation for single-value fields
  const enumFields = {
    condition: ["New", "Used"],
    fuelType: ["Petrol", "Diesel", "Hybrid", "Electric"],
    transmission: ["Manual", "Automatic"],
    regionalSpec: ["GCC", "American", "Canadian", "European"],
    bodyType: [
      "Roadster",
      "Cabriolet",
      "Super",
      "Hatchback",
      "Micro",
      "Station",
      "Sedan",
      "Muscle",
      "Sports",
      "Targa",
      "Convertible",
      "Coupe",
      "Hybrid",
      "SUV",
      "Pickup",
      "Van",
    ],
    ownerType: ["Owner", "Dealer", "Dealership"],
    warranty: ["Yes", "No", "Doesn't Apply"],
  };

  Object.keys(enumFields).forEach((field) => {
    if (query[field]) {
      const values = parseArray(query[field]);
      if (values.length > 0) {
        if (!values.every((val) => enumFields[field].includes(val))) {
          throw new Error(
            `Invalid ${field} value(s). Must be one of: ${enumFields[
              field
            ].join(", ")}`
          );
        }
        filter[field] = values.length === 1 ? values[0] : { $in: values };
      }
    }
  });

  // Multi-select for array fields (features uses $all)
  const arrayFilters = ["features", "colorExterior", "colorInterior"];
  arrayFilters.forEach((field) => {
    if (query[field]) {
      const values = parseArray(query[field]);
      if (values.length > 0) {
        if (field === "features") {
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
      if (!isNaN(engineMax) && engineMax !== Infinity)
        filter.engineCapacity.$lte = engineMax;
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

  // Battery Range range (numeric) - E-bike specific
  if (query.batteryRangeMin || query.batteryRangeMax) {
    const batteryRangeMin = query.batteryRangeMin
      ? Number(query.batteryRangeMin)
      : 0;
    const batteryRangeMax = query.batteryRangeMax
      ? Number(query.batteryRangeMax)
      : Infinity;

    if (!isNaN(batteryRangeMin) || !isNaN(batteryRangeMax)) {
      filter.batteryRange = {};
      if (!isNaN(batteryRangeMin)) filter.batteryRange.$gte = batteryRangeMin;
      if (!isNaN(batteryRangeMax) && batteryRangeMax !== Infinity)
        filter.batteryRange.$lte = batteryRangeMax;
    }
  }

  // Motor Power range (numeric) - E-bike specific
  if (query.motorPowerMin || query.motorPowerMax) {
    const motorPowerMin = query.motorPowerMin ? Number(query.motorPowerMin) : 0;
    const motorPowerMax = query.motorPowerMax
      ? Number(query.motorPowerMax)
      : Infinity;

    if (!isNaN(motorPowerMin) || !isNaN(motorPowerMax)) {
      filter.motorPower = {};
      if (!isNaN(motorPowerMin)) filter.motorPower.$gte = motorPowerMin;
      if (!isNaN(motorPowerMax) && motorPowerMax !== Infinity)
        filter.motorPower.$lte = motorPowerMax;
    }
  }

  // Numeric range filters
  const rangeFilters = [
    { queryMin: "priceMin", queryMax: "priceMax", field: "price" },
    { queryMin: "yearMin", queryMax: "yearMax", field: "year" },
    { queryMin: "mileageMin", queryMax: "mileageMax", field: "mileage" },
    { queryMin: "doorsMin", queryMax: "doorsMax", field: "carDoors" },
    { queryMin: "cylMin", queryMax: "cylMax", field: "numberOfCylinders" },
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
      if (
        userLat >= -90 &&
        userLat <= 90 &&
        userLng >= -180 &&
        userLng <= 180
      ) {
        locationFilter.radius = radius; // in kilometers
        locationFilter.userLocation = {
          type: "Point",
          coordinates: [userLng, userLat], // MongoDB format: [longitude, latitude]
        };
      }
    }
  }

  return { filter, locationFilter };
};
