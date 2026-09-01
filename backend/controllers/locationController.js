const Location = require("../models/Location");

// Get all locations
const getLocations = async (req, res) => {
  try {
    const locations = await Location.find()
      .sort({ name: 1 })
      .lean();

    res.json({
      success: true,
      data: locations,
    });
  } catch (error) {
    console.error("Get locations error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch locations",
    });
  }
};

// Create location
const createLocation = async (req, res) => {
  try {
    const name = req.body.name?.trim();

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Location name is required",
      });
    }

    const existingLocation = await Location.findOne({
      name: { $regex: `^${name}$`, $options: "i" },
    });

    if (existingLocation) {
      return res.status(409).json({
        success: false,
        message: "Location already exists",
      });
    }

    const location = await Location.create({
      name,
    });

    res.status(201).json({
      success: true,
      message: "Location created successfully",
      data: location,
    });
  } catch (error) {
    console.error("Create location error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create location",
    });
  }
};

module.exports = {
  getLocations,
  createLocation,
};