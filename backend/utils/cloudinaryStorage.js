const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinary');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'paysync_clients', // Optional folder name in Cloudinary
    allowed_formats: ['jpg', 'png', 'jpeg', 'pdf'],
  },
});

module.exports = storage;
