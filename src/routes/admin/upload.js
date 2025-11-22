import express from "express";
import { uploadProfilePhoto } from "../../config/multer.js";
import { pool } from "../../db.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

/**
 * @route   POST /api/admin/users/:userId/upload-photo
 * @desc    Upload profile photo for a user
 * @access  Super Admin
 */
export async function uploadUserPhotoHandler(req, res) {
  try {
    const { userId } = req.params;

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    // Check if user exists
    const userCheck = await pool.query(
      "SELECT id, email, profile_photo_url FROM molam_users WHERE id = $1",
      [userId]
    );

    if (userCheck.rows.length === 0) {
      // Delete uploaded file if user doesn't exist
      await fs.unlink(req.file.path);
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const user = userCheck.rows[0];

    // Delete old profile photo if it exists
    if (user.profile_photo_url) {
      try {
        const oldPhotoPath = path.join(
          __dirname,
          "../../../public",
          user.profile_photo_url.replace(/^\//, "")
        );
        await fs.unlink(oldPhotoPath);
      } catch (err) {
        // Ignore error if old file doesn't exist
        console.log("Could not delete old photo:", err.message);
      }
    }

    // Generate URL for the uploaded photo
    const photoUrl = `/uploads/profile-photos/${req.file.filename}`;

    // Update user's profile_photo_url
    const updateResult = await pool.query(
      "UPDATE molam_users SET profile_photo_url = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, first_name, last_name, profile_photo_url",
      [photoUrl, userId]
    );

    const updatedUser = updateResult.rows[0];

    // Log audit
    await pool.query(
      `INSERT INTO molam_audit_logs (actor_id, action, target_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        req.user.user_id,
        "user_photo_uploaded",
        userId,
        JSON.stringify({
          filename: req.file.filename,
          size: req.file.size,
          mimetype: req.file.mimetype,
          url: photoUrl,
        }),
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Profile photo uploaded successfully",
      data: {
        user: updatedUser,
        photoUrl: photoUrl,
      },
    });
  } catch (error) {
    console.error("Upload photo error:", error);

    // Delete uploaded file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkErr) {
        console.error("Error deleting file on error:", unlinkErr);
      }
    }

    return res.status(500).json({
      success: false,
      error: "Failed to upload profile photo",
      details: error.message,
    });
  }
}

/**
 * @route   DELETE /api/admin/users/:userId/photo
 * @desc    Delete profile photo for a user
 * @access  Super Admin
 */
export async function deleteUserPhotoHandler(req, res) {
  try {
    const { userId } = req.params;

    // Get user
    const userResult = await pool.query(
      "SELECT id, email, profile_photo_url FROM molam_users WHERE id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const user = userResult.rows[0];

    if (!user.profile_photo_url) {
      return res.status(400).json({
        success: false,
        error: "User has no profile photo",
      });
    }

    // Delete photo file
    try {
      const photoPath = path.join(
        __dirname,
        "../../../public",
        user.profile_photo_url.replace(/^\//, "")
      );
      await fs.unlink(photoPath);
    } catch (err) {
      console.log("Could not delete photo file:", err.message);
    }

    // Update user record
    await pool.query(
      "UPDATE molam_users SET profile_photo_url = NULL, updated_at = NOW() WHERE id = $1",
      [userId]
    );

    // Log audit
    await pool.query(
      `INSERT INTO molam_audit_logs (actor_id, action, target_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        req.user.user_id,
        "user_photo_deleted",
        userId,
        JSON.stringify({ deletedUrl: user.profile_photo_url }),
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Profile photo deleted successfully",
    });
  } catch (error) {
    console.error("Delete photo error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to delete profile photo",
      details: error.message,
    });
  }
}

export default router;
