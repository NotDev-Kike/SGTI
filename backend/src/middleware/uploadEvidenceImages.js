const multer = require('multer');

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_COUNT = 5;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: MAX_IMAGE_COUNT,
    fields: 20,
    parts: MAX_IMAGE_COUNT + 20
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) {
      return callback(new Error('Solo se permiten imágenes JPG, PNG, GIF o WebP.'));
    }
    callback(null, true);
  }
});

const parseEvidenceImages = (req, res, next) => {
  upload.array('imagenes', MAX_IMAGE_COUNT)(req, res, error => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? 'Cada imagen puede pesar hasta 10 MB.'
        : error.code === 'LIMIT_FILE_COUNT'
          ? 'Se permiten hasta 5 imágenes por envío.'
          : 'La carga contiene demasiados campos o datos.';
      return res.status(413).json({ success: false, error: message });
    }
    return res.status(400).json({ success: false, error: error.message });
  });
};

const getImageMimeType = buffer => {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6))) return 'image/gif';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
};

const validarImagenes = (req, res, next) => {
  const invalid = (req.files || []).find(file => getImageMimeType(file.buffer) !== file.mimetype);
  if (invalid) return res.status(400).json({ success: false, error: 'El contenido de una imagen no coincide con su formato.' });
  next();
};

module.exports = {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_COUNT,
  getImageMimeType,
  parseEvidenceImages,
  validarImagenes
};
