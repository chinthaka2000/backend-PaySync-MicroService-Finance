# File Handling and Document Management System

## Overview

This implementation provides comprehensive file handling and document management capabilities for the PaySync microfinance system, including secure file uploads, professional agreement generation, and role-based access control.

## Features Implemented

### 1. Secure File Upload Middleware
- **Enhanced validation** with file type, size, and content checking
- **Magic number validation** to prevent file type spoofing
- **Secure filename generation** with sanitization
- **Organized folder structure** by category, date, and user
- **Cloudinary integration** for cloud storage
- **Role-based access control** for uploads

### 2. Document Storage System
- **Proper naming conventions** with timestamps and user IDs
- **Categorized storage** (client documents, agreements, general files)
- **Metadata tracking** for audit trails
- **File organization** by year/month/user structure
- **Duplicate prevention** through unique naming

### 3. File Download with Access Control
- **Role-based permissions** for file access
- **Secure download URLs** with expiration
- **Access logging** for audit trails
- **Content-Type headers** for proper browser handling
- **Regional access control** for data segregation

### 4. Professional Agreement Generation
- **PDF generation** using PDFKit library
- **Professional templates** with company branding
- **Loan calculation engine** for payment schedules
- **Multi-language support** ready
- **Digital signatures** section included
- **Terms and conditions** integration

## API Endpoints

### File Management
```
POST   /api/files/upload                    - General file upload
POST   /api/files/clients/:id/documents     - Client document upload
POST   /api/files/images                    - Image upload
POST   /api/files/agreements                - Agreement upload
GET    /api/files/:fileId/download          - Download file
GET    /api/files/:fileId                   - Get file info
GET    /api/files                           - List files
DELETE /api/files/:fileId                   - Delete file
```

### Agreement Management
```
POST   /api/agreements/generate/:loanId     - Generate agreement
GET    /api/agreements/:id/download         - Download agreement
GET    /api/agreements/:id                  - Get agreement info
GET    /api/agreements                      - List agreements
POST   /api/agreements/:id/send             - Send via email
PUT    /api/agreements/:id/regenerate       - Regenerate agreement
```

## File Categories and Limits

| Category      | Max Size | Allowed Types           | Description                |
|---------------|----------|-------------------------|----------------------------|
| DOCUMENTS     | 5MB      | PDF, DOC, DOCX, TXT    | General documents          |
| IMAGES        | 2MB      | JPG, PNG, GIF, WebP    | Profile and general images |
| ID_DOCUMENTS  | 3MB      | JPG, PNG, PDF          | Identity verification docs |
| AGREEMENTS    | 10MB     | PDF only               | Loan agreements            |

## Security Features

### File Validation
- **File type checking** against MIME type and extension
- **Magic number validation** to prevent spoofing
- **Size limits** per category
- **Filename sanitization** to prevent path traversal
- **Dangerous file detection** (executables, scripts)

### Access Control
- **Role-based permissions** for all operations
- **Regional data segregation** for managers and agents
- **Owner-based access** for personal files
- **Audit logging** for all file operations

### Secure Storage
- **Cloudinary integration** with secure URLs
- **Temporary download links** with expiration
- **Organized folder structure** for easy management
- **Metadata tracking** for compliance

## Usage Examples

### Upload Client Documents
```javascript
// Frontend form data
const formData = new FormData();
formData.append('idCard', idCardFile);
formData.append('employmentLetter', employmentFile);

// API call
const response = await fetch('/api/files/clients/123/documents', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});
```

### Generate Loan Agreement
```javascript
const response = await fetch('/api/agreements/generate/loanId123', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    template: 'standard',
    language: 'en',
    includeTerms: true
  })
});
```

## Configuration

### Environment Variables
```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
UPLOAD_DIR=uploads
```

### File Size Limits (configurable in FileService)
```javascript
this.maxFileSize = {
  DOCUMENTS: 5 * 1024 * 1024,     // 5MB
  IMAGES: 2 * 1024 * 1024,        // 2MB
  ID_DOCUMENTS: 3 * 1024 * 1024,  // 3MB
  AGREEMENTS: 10 * 1024 * 1024    // 10MB
};
```

## Testing

Run the file handling tests:
```bash
node test-file-handling-simple.js
```

This will test all core functionality without requiring database connection.

## Implementation Status

✅ **Completed Features:**
- Secure file upload middleware with validation
- Document storage with proper naming conventions
- File download endpoints with access control
- Agreement generation with professional templates
- Role-based permissions integration
- Comprehensive error handling and logging
- API documentation and testing

🔄 **Future Enhancements:**
- Bulk file operations (download/delete)
- File statistics and analytics
- Email integration for agreement sending
- Advanced file search and filtering
- File versioning system
- Automated file cleanup policies

## Dependencies

- **pdfkit**: PDF generation library
- **multer**: File upload handling
- **multer-storage-cloudinary**: Cloudinary storage adapter
- **cloudinary**: Cloud storage service
- **joi**: Input validation
- **mongoose**: Database integration

## Error Handling

All file operations include comprehensive error handling with:
- **Structured error responses** with error codes
- **Detailed logging** for debugging
- **User-friendly messages** for client display
- **Audit trail logging** for security events
- **Graceful degradation** for service failures