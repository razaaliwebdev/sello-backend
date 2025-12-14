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
      "sellerType",
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
      "engineCapacity",
      "transmission",
      "regionalSpec",
      "city",
      "contactNumber",
      "sellerType",
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
      "horsepower",
      "numberOfCylinders",
      "geoLocation", // Made optional
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
      "engineCapacity",
      "transmission",
      "regionalSpec",
      "city",
      "contactNumber",
      "sellerType",
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
      "horsepower",
      "numberOfCylinders",
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
      "engineCapacity",
      "transmission",
      "regionalSpec",
      "bodyType",
      "city",
      "contactNumber",
      "sellerType",
      "warranty",
      "ownerType",
      "geoLocation",
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
      "geoLocation", // Made optional
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
      "fuelType",
      "engineCapacity",
      "transmission",
      "regionalSpec",
      "city",
      "contactNumber",
      "sellerType",
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
      "horsepower",
      "geoLocation", // Made optional
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
      "fuelType",
      "transmission",
      "regionalSpec",
      "city",
      "contactNumber",
      "sellerType",
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
      "batteryRange",
      "motorPower",
      "geoLocation", // Made optional
    ],
  },
};

/**
 * Get required fields for a vehicle type
 */
export const getRequiredFields = (vehicleType) => {
  return VEHICLE_FIELD_CONFIG[vehicleType]?.required || VEHICLE_FIELD_CONFIG.Car.required;
};

/**
 * Get optional fields for a vehicle type
 */
export const getOptionalFields = (vehicleType) => {
  return VEHICLE_FIELD_CONFIG[vehicleType]?.optional || VEHICLE_FIELD_CONFIG.Car.optional;
};

/**
 * Validate required fields for a vehicle type
 */
export const validateRequiredFields = (vehicleType, data) => {
  const requiredFields = getRequiredFields(vehicleType);
  const missing = [];
  
  requiredFields.forEach(key => {
    const value = data[key];
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      missing.push(key);
    }
  });
  
  return {
    isValid: missing.length === 0,
    missing,
  };
};
