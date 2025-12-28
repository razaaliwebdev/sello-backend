import mongoose from 'mongoose';
import dotenv from 'dotenv';
import VehicleType from '../models/vehicleTypeModel.js';
import CategoryField from '../models/categoryFieldModel.js';

dotenv.config();

const seed = async () => {
    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sello-db';
        await mongoose.connect(mongoUri);
        console.log("Connected to DB");

        // 1. Create/Update "Car" VehicleType
        const carType = await VehicleType.findOneAndUpdate(
            { name: "Car" },
            { name: "Car", slug: "car", isActive: true },
            { upsert: true, new: true }
        );
        console.log("Car VehicleType synced:", carType._id);

        // 2. Define Fields for Car (Full set to match Regression requirement)
        const carFields = [
            // Standard Fields
            { name: "title", label: "Ad Title", type: "text", required: true, order: 1 },
            { name: "price", label: "Price (PKR)", type: "number", required: true, order: 2 },
            { name: "description", label: "Description", type: "textarea", required: false, order: 3 },
            
            // Car Specifics
            { name: "make", label: "Make", type: "text", required: true, order: 4 },
            { name: "model", label: "Model", type: "text", required: true, order: 5 },
            { name: "variant", label: "Variant", type: "text", required: false, order: 6 },
            { name: "year", label: "Year", type: "number", required: true, order: 7, validationRules: { min: 1900, max: 2026 } },
            { name: "condition", label: "Condition", type: "select", required: true, order: 8, options: [{label:"New", value:"New"}, {label:"Used", value:"Used"}] },
            { name: "transmission", label: "Transmission", type: "select", required: true, order: 9, options: [{label:"Manual", value:"Manual"}, {label:"Automatic", value:"Automatic"}] },
            { name: "fuelType", label: "Fuel Type", type: "select", required: true, order: 10, options: [{label:"Petrol", value:"Petrol"}, {label:"Diesel", value:"Diesel"}, {label:"Hybrid", value:"Hybrid"}, {label:"Electric", value:"Electric"}] },
            { name: "mileage", label: "Mileage (km)", type: "number", required: true, order: 11 },
            { name: "colorExterior", label: "Exterior Color", type: "text", required: false, order: 12 },
            { name: "colorInterior", label: "Interior Color", type: "text", required: false, order: 13 },
            { name: "regionalSpec", label: "Regional Spec", type: "select", required: true, order: 14, options: [{label:"GCC", value:"GCC"}, {label:"American", value:"American"}, {label:"Canadian", value:"Canadian"}, {label:"European", value:"European"}] },
            { name: "warranty", label: "Warranty", type: "select", required: true, order: 15, options: [{label:"Yes", value:"Yes"}, {label:"No", value:"No"}, {label:"Doesn't Apply", value:"Doesn't Apply"}] },
            { name: "ownerType", label: "Owner Type", type: "select", required: true, order: 16, options: [{label:"Owner", value:"Owner"}, {label:"Dealer", value:"Dealer"}, {label:"Dealership", value:"Dealership"}] },
            
            // Detailed Specs
            { name: "bodyType", label: "Body Type", type: "select", required: false, order: 17, options: ["Roadster", "Cabriolet", "Super", "Hatchback", "Micro", "Station", "Sedan", "Muscle", "Sports", "Targa", "Convertible", "Coupe", "Hybrid", "SUV", "Pickup", "Van"].map(o => ({label:o, value:o})) },
            { name: "carDoors", label: "Doors", type: "number", required: false, order: 18 },
            { name: "horsepower", label: "Horsepower", type: "number", required: false, order: 19 },
            { name: "engineCapacity", label: "Engine Capacity (cc)", type: "number", required: false, order: 20 },
            { name: "numberOfCylinders", label: "No. of Cylinders", type: "number", required: false, order: 21 },
            
            // Location / Contact
            { name: "city", label: "City", type: "text", required: true, order: 22 },
            { name: "location", label: "Location Area", type: "text", required: false, order: 23 },
            { name: "contactNumber", label: "Contact Number", type: "text", required: true, order: 24, placeholder: "+971..." },
            { name: "sellerType", label: "Seller Type", type: "select", required: true, order: 25, options: [{label:"individual", value:"individual"}, {label:"dealer", value:"dealer"}] }
        ];

        // 3. Clear existing fields for this type to allow clean seed
        await CategoryField.deleteMany({ vehicleType: carType._id });

        // 4. Insert
        const fieldsToInsert = carFields.map(f => ({ ...f, vehicleType: carType._id }));
        await CategoryField.insertMany(fieldsToInsert);

        console.log(`Seeded ${fieldsToInsert.length} fields for Car.`);
        
        // Seed a "Bike" type for testing (New Flow)
        const bikeType = await VehicleType.findOneAndUpdate(
            { name: "Bike" },
            { name: "Bike", slug: "bike", isActive: true },
            { upsert: true, new: true }
        );
        const bikeFields = [
             { name: "title", label: "Ad Title", type: "text", required: true, order: 1 },
             { name: "price", label: "Price", type: "number", required: true, order: 2 },
             { name: "description", label: "Description", type: "textarea", required: false, order: 3 },
             { name: "make", label: "Brand", type: "text", required: true, order: 4 },
             { name: "model", label: "Model", type: "text", required: true, order: 5 },
             { name: "year", label: "Year", type: "number", required: true, order: 6 },
             { name: "city", label: "City", type: "text", required: true, order: 7 },
             { name: "condition", label: "Condition", type: "select", required: true, order: 8, options: [{label:"New", value:"New"}, {label:"Used", value:"Used"}] },
             // E-bike/Bike specific
             { name: "batteryRange", label: "Battery Range (km)", type: "number", required: false, order: 9 }, // For E-bikes mainly, but flexible
             { name: "contactNumber", label: "Contact Number", type: "text", required: true, order: 10 },
        ];
        // Note: reusing "make" for Brand
        await CategoryField.deleteMany({ vehicleType: bikeType._id });
        await CategoryField.insertMany(bikeFields.map(f => ({ ...f, vehicleType: bikeType._id })));
        console.log(`Seeded fields for Bike.`);

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seed();
