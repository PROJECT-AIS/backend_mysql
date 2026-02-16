const prisma = require('../prisma/client');
const fs = require('fs');
const path = require('path');

// Get current user profile
const getProfile = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: {
                id: req.userId
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                profileImage: true,
                createdAt: true,
                updatedAt: true
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Profile retrieved successfully",
            data: user
        });
    } catch (error) {
        console.error("Get profile error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Update user profile
const updateProfile = async (req, res) => {
    try {
        const { name, phone } = req.body;

        const updatedUser = await prisma.user.update({
            where: {
                id: req.userId
            },
            data: {
                name: name,
                phone: phone
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                profileImage: true,
                createdAt: true,
                updatedAt: true
            }
        });

        res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            data: updatedUser
        });
    } catch (error) {
        console.error("Update profile error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Upload profile image
const uploadProfileImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No file uploaded"
            });
        }

        // Get current user to check for existing profile image
        const currentUser = await prisma.user.findUnique({
            where: { id: req.userId },
            select: { profileImage: true }
        });

        // Delete old profile image if exists
        if (currentUser?.profileImage) {
            const oldImagePath = path.join(__dirname, '..', 'uploads', path.basename(currentUser.profileImage));
            if (fs.existsSync(oldImagePath)) {
                fs.unlinkSync(oldImagePath);
            }
        }

        // Generate image URL
        const imageUrl = `/uploads/${req.file.filename}`;

        // Update user with new profile image
        const updatedUser = await prisma.user.update({
            where: {
                id: req.userId
            },
            data: {
                profileImage: imageUrl
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                profileImage: true,
                createdAt: true,
                updatedAt: true
            }
        });

        res.status(200).json({
            success: true,
            message: "Profile image uploaded successfully",
            data: updatedUser
        });
    } catch (error) {
        console.error("Upload profile image error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Delete profile image
const deleteProfileImage = async (req, res) => {
    try {
        // Get current user
        const currentUser = await prisma.user.findUnique({
            where: { id: req.userId },
            select: { profileImage: true }
        });

        // Delete the file if exists
        if (currentUser?.profileImage) {
            const imagePath = path.join(__dirname, '..', 'uploads', path.basename(currentUser.profileImage));
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        // Update user to remove profile image
        const updatedUser = await prisma.user.update({
            where: {
                id: req.userId
            },
            data: {
                profileImage: null
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                profileImage: true,
                createdAt: true,
                updatedAt: true
            }
        });

        res.status(200).json({
            success: true,
            message: "Profile image deleted successfully",
            data: updatedUser
        });
    } catch (error) {
        console.error("Delete profile image error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

module.exports = { getProfile, updateProfile, uploadProfileImage, deleteProfileImage };
