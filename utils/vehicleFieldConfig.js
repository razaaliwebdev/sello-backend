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
      "bodyType", // Bus body types: School Bus, Coach, Mini Bus, etc.
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
      "engineCapacity",
      "transmission",
      "regionalSpec",
      "bodyType", // Truck body types: Pickup, Flatbed, Box Truck, Dump Truck, etc.
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
      "fuelType",
      "engineCapacity", // Displacement in cc - important for motorcycles
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
      "numberOfCylinders", // Bikes can have 1, 2, 3, 4, or 6 cylinders
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
