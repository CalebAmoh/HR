const path    = require('path');
const fs      = require('fs');
const respond = require('../helpers/respondHelper');
const asyncHandler = require('../middleware/asyncHandler');
const { UPLOAD_DIR } = require('../middleware/upload');

// POST /employees/documents/upload
const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) return respond.badReq(res, 'No file provided');
  respond.ok(res, 'Document uploaded', { filename: req.file.filename });
});

// GET /documents/:filename
const downloadDocument = asyncHandler(async (req, res) => {
  const { filename } = req.params;

  // Prevent path traversal
  const safe = path.basename(filename);
  const filePath = path.join(UPLOAD_DIR, safe);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'Document not found' });
  }

  res.download(filePath, safe);
});

module.exports = { uploadDocument, downloadDocument };
