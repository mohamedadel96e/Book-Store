const Book = require("../models/Book");
const {
  uploadPDF,
  deleteFromCloudinary,
  deletePDFFromLocal,
} = require("../utils/uploadService");

// Helper function to extract filename from local PDF URL
const getFilenameFromLocalUrl = (url) => {
  if (!url) return null;
  // Example URL: /storage/pdfs/filename.pdf
  // We need to extract: 'filename.pdf'
  try {
    const parts = url.split("/");
    return parts[parts.length - 1];
  } catch (error) {
    console.error("Error extracting filename from URL:", url, error);
    return null;
  }
};

// Helper function to extract public_id from Cloudinary raw URL
const getPublicIdFromRawUrl = (url) => {
  if (!url) return null;
  // Example URL: https://res.cloudinary.com/<cloud_name>/raw/upload/v123456789/knowledge-vault/pdfs/some_id
  // We need to extract: 'knowledge-vault/pdfs/some_id'
  try {
    const path = url.split("/upload/")[1];
    const publicId = path.substring(path.indexOf("/") + 1);
    return publicId;
  } catch (error) {
    console.error("Error extracting public_id from URL:", url, error);
    return null;
  }
};

// Helper function to determine if URL is local or Cloudinary
const isLocalUrl = (url) => {
  return url && url.startsWith("/storage/");
};

exports.getBooks = async (req, res) => {
  try {
    const books = await Book.find();
    res.json(books);
  } catch (err) {
    res.status(500).json({error: err.message});
  }
};
exports.getBookById = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({error: "Book not found"});
    }
    res.json(book);
  } catch (err) {
    res.status(500).json({error: err.message});
  }
};
exports.createBook = async (req, res) => {
  try {
    // 1. Check if a file was uploaded.
    if (!req.file) {
      return res
        .status(400)
        .json({error: "Book content (PDF File) is required."});
    }

    const sanitizePublicId = (filename) => {
      return filename.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
    };

    const publicId = req.body.public_id
      ? sanitizePublicId(req.body.public_id)
      : `${sanitizePublicId(
          req.file.originalname.replace(/\.[^/.]+$/, "")
        )}_${Date.now()}`;

    // 2. Upload the file buffer to Cloudinary.
    const uploadResult = await uploadPDF(req.file.buffer, {
      filename: `${publicId}.pdf`,
      overwrite: req.body.overwrite === "true",
    });

    // 3. Prepare book data with the Cloudinary URL and other body fields.
    const bookData = {
      ...req.body,
      contentUrl: uploadResult.secure_url,
    };

    // 4. Create and save the new book.
    const newBook = new Book(bookData);
    await newBook.save();
    res.status(201).json(newBook);
  } catch (err) {
    res.status(400).json({error: err.message});
  }
};
exports.updateBook = async (req, res) => {
  try {
    const updateData = {
      ...req.body,
    };

    // If a new file is uploaded, handle the replacement
    if (req.file) {
      // Find the existing book to get the old file's URL
      const existingBook = await Book.findById(req.params.id);
      if (existingBook && existingBook.contentUrl) {
        // Check if it's a local file or Cloudinary file and delete accordingly
        if (isLocalUrl(existingBook.contentUrl)) {
          const filename = getFilenameFromLocalUrl(
            existingBook.contentUrl
          );
          if (filename) {
            try {
              await deletePDFFromLocal(filename);
            } catch (error) {
              console.warn(
                "Could not delete old PDF file:",
                error.message
              );
            }
          }
        } else {
          // Legacy Cloudinary file
          const publicId = getPublicIdFromRawUrl(
            existingBook.contentUrl
          );
          if (publicId) {
            try {
              await deleteFromCloudinary(publicId, "raw");
            } catch (error) {
              console.warn(
                "Could not delete old Cloudinary file:",
                error.message
              );
            }
          }
        }
      }

      const sanitizePublicId = (filename) => {
        return filename.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
      };

      const publicId = req.body.public_id
        ? sanitizePublicId(req.body.public_id)
        : `${sanitizePublicId(
            req.file.originalname.replace(/\.[^/.]+$/, "")
          )}_${Date.now()}`;
      // Upload the new file and update the contentUrl in our update data
      const uploadResult = await uploadPDF(req.file.buffer, {
        filename: `${publicId}.pdf`,
        overwrite: req.body.overwrite === "true",
      });
      updateData.contentUrl = uploadResult.secure_url;
    }
    // Perform the update in the database
    const book = await Book.findByIdAndUpdate(
      req.params.id,
      updateData,
      {new: true}
    );

    if (!book) {
      return res.status(404).json({error: "Book not found"});
    }

    res.json(book);
  } catch (err) {
    res.status(400).json({error: err.message});
  }
};
exports.deleteBook = async (req, res) => {
  try {
    // 1. Find the book document before deleting it
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({error: "Book not found"});
    }

    // 2. Extract public_id from the URL and delete the file from Cloudinary
    if (book.contentUrl) {
      if (isLocalUrl(book.contentUrl)) {
        const filename = getFilenameFromLocalUrl(book.contentUrl);
        if (filename) {
          try {
            await deletePDFFromLocal(filename);
          } catch (error) {
            console.warn("Could not delete PDF file:", error.message);
          }
        }
      } else {
        // Legacy Cloudinary file
        const publicId = getPublicIdFromRawUrl(book.contentUrl);
        if (publicId) {
          try {
            await deleteFromCloudinary(publicId, "raw");
          } catch (error) {
            console.warn(
              "Could not delete Cloudinary file:",
              error.message
            );
          }
        }
      }
    }

    // 3. Delete the book document from MongoDB
    await Book.findByIdAndDelete(req.params.id);

    res.json({message: "Book deleted successfully"});
  } catch (err) {
    res.status(500).json({error: err.message});
  }
};
