/**
 * Backend validation configuration for vehicle fields based on vehicle type
 * This mirrors the frontend configuration to ensure consistent validation
 */

export const VEHICLE_FIELD_CONFIG = {
  Car: {
    required: [
      "title",
      "make",
      "model",
      "year",
      "condition",
      "price",
      "fuelType",
      "engineCapacity",
      "transmission",
      "regionalSpec",
      "bodyType",
      "city",
      "contactNumber",
      "warranty",
      "ownerType",
    ],
    optional: [
      "description",
      "variant",
      "colorExterior",
      "colorInterior",
      "mileage",
      "features",
      "location",
      "carDoors",
      "horsepower",
      "numberOfCylinders",
      "geoLocation", // Made optional - will use default if not provided
    ],
  },
  Bus: {
    required: [
      "title",
      "make",
      "model",
      "year",
      "condition",
      "price",
      "fuelType",
      "bodyType",
      "city",
      "contactNumber",
    ],
    optional: [
      "description",
      "variant",
      "colorExterior",
      "colorInterior",
      "mileage",
      "features",
      "location",
      "geoLocation",
    ],
  },
  Truck: {
    required: [
      "title",
      "make",
      "model",
      "year",
      "condition",
      "price",
      "fuelType",
      "bodyType",
      "city",
      "contactNumber",
    ],
    optional: [
      "description",
      "variant",
      "colorExterior",
      "colorInterior",
      "mileage",
      "features",
      "location",
      "geoLocation",
    ],
  },
  Van: {
    required: [
      "title",
      "make",
      "model",
      "year",
      "condition",
      "price",
      "fuelType",
      "bodyType",
      "city",
      "contactNumber",
    ],
    optional: [
      "description",
      "variant",
      "colorExterior",
      "colorInterior",
      "mileage",
      "features",
      "location",
      "geoLocation",
    ],
  },
  Bike: {
    required: [
      "title",
      "make",
      "model",
      "year",
      "condition",
      "price",
      "bodyType",
      "city",
      "contactNumber",
    ],
    optional: [
      "description",
      "variant",
      "colorExterior",
      "colorInterior",
      "mileage",
      "features",
      "location",
      "geoLocation",
    ],
  },
  "E-bike": {
    required: [
      "title",
      "make",
      "model",
      "year",
      "condition",
      "price",
      "city",
      "contactNumber",
    ],
    optional: [
      "description",
      "variant",
      "colorExterior",
      "colorInterior",
      "mileage",
      "features",
      "location",
      "batteryRange",
      "motorPower",
      "fuelType", // E-bikes are electric, but some might want to specify
      "transmission", // E-bikes may have gears
      "regionalSpec",
      "geoLocation",
    ],
  },
};

/**
 * Get required fields for a vehicle type
 */
export const getRequiredFields = (vehicleType) => {
  const config =
    VEHICLE_FIELD_CONFIG[vehicleType]?.required ||
    VEHICLE_FIELD_CONFIG.Car.required;
  console.log("DEBUG GET_FIELDS - Vehicle type:", vehicleType);
  console.log(
    "DEBUG GET_FIELDS - Config found:",
    !!VEHICLE_FIELD_CONFIG[vehicleType]
  );
  console.log("DEBUG GET_FIELDS - Required fields:", config);
  return config;
};

/**
 * Get optional fields for a vehicle type
 */
export const getOptionalFields = (vehicleType) => {
  return (
    VEHICLE_FIELD_CONFIG[vehicleType]?.optional ||
    VEHICLE_FIELD_CONFIG.Car.optional
  );
};

/**
 * Validate required fields for a vehicle type
 */
export const validateRequiredFields = (vehicleType, data) => {
  const requiredFields = getRequiredFields(vehicleType);
  const missing = [];

  console.log("DEBUG VALIDATION - Vehicle type:", vehicleType);
  console.log("DEBUG VALIDATION - Required fields:", requiredFields);
  console.log("DEBUG VALIDATION - Data keys:", Object.keys(data));
  console.log("DEBUG VALIDATION - Data:", data);

  requiredFields.forEach((key) => {
    const value = data[key];
    if (!value || (typeof value === "string" && value.trim() === "")) {
      console.log("DEBUG VALIDATION - Missing field:", key, "Value:", value);
      missing.push(key);
    }
  });

  console.log("DEBUG VALIDATION - Missing fields:", missing);

  return {
    isValid: missing.length === 0,
    missing,
  };
};
