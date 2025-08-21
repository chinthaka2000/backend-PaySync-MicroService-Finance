const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../utils/cloudinary");

// Configure Multer to upload directly to Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "paysync_clients", // Cloudinary folder name
    allowed_formats: ["jpg", "png", "jpeg", "pdf"], // allowed file types
    public_id: (req, file) => Date.now() + "-" + file.originalname, // custom file name
  },
});

const upload = multer({ storage });

module.exports = upload;
