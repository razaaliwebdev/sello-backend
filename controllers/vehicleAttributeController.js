import VehicleType from '../models/vehicleTypeModel.js';
import CategoryField from '../models/categoryFieldModel.js';

// Get all active vehicle types
export const getVehicleTypes = async (req, res) => {
    try {
        const types = await VehicleType.find({ isActive: true }).select('name slug _id');
        res.status(200).json(types);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get fields for a specific vehicle type
export const getFieldsForType = async (req, res) => {
    try {
        const { id } = req.params;
        const fields = await CategoryField.find({ vehicleType: id }).sort({ order: 1 });
        res.status(200).json(fields);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
