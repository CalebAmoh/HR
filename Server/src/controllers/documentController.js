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

// GET /documents/:filename  — served inline so images/PDFs render in the browser
const downloadDocument = asyncHandler(async (req, res) => {
  const { filename } = req.params;

  // Prevent path traversal
  const safe = path.basename(filename);
  const filePath = path.join(UPLOAD_DIR, safe);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'Document not found' });
  }

  const mimeMap = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png',  '.gif': 'image/gif', '.webp': 'image/webp',
    '.pdf': 'application/pdf',
  };
  const ext         = path.extname(safe).toLowerCase();
  const contentType = mimeMap[ext] || 'application/octet-stream';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${safe}"`);
  res.sendFile(filePath);
});

module.exports = { uploadDocument, downloadDocument };
