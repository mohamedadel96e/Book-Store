const e = require("express");
const Book = require("../models/Book");
const Inventory = require("../models/Inventory");
const Transaction = require("../models/Transactions");
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
exports.purchaseBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({error: "Book not found"});
    }

    // Check if the user has already purchased the book
    const existingPurchase = await Inventory.findOne({
      user: req.user.id,
      book: req.params.id
    });

    if (existingPurchase) {
      return res.status(400).json({error: "Book already purchased"});
    }

    // Create a new inventory entry for the purchase
    const newPurchase = new Inventory({
      user: req.user.id,
      book: req.params.id,
      ownershipType: "owned"
    });

    const newTransaction = new Transaction({
      user: req.user.id,
      book: req.params.id,
      type: "purchase",
      amount: 1,
      transactionDate: new Date()
    });

    await Promise.all([newPurchase.save(), newTransaction.save()]);
    res.status(201).json({message: "Book purchased successfully"});
  } catch (err) {
    res.status(500).json({error: err.message});
  }
};
exports.downloadBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ error: "Book not found" });
    }

    // Check if the book exists in user's inventory
    const inventory = await Inventory.findOne({ 
      user: req.user.id, 
      book: req.params.id,
      ownershipType: 'owned'
    });
    
    if (!inventory) {
      return res.status(403).json({ error: "You don't own this book" });
    }

    if (!book.contentUrl) {
      return res.status(404).json({ error: "Book content not found" });
    }

    // For Cloudinary URLs, redirect to the secure URL
    if (!isLocalUrl(book.contentUrl)) {
      return res.json({ downloadUrl: book.contentUrl });
    }

    // For local files, send the file from disk
    const filename = getFilenameFromLocalUrl(book.contentUrl);
    if (!filename) {
      return res.status(404).json({ error: "PDF file not found" });
    }

    const path = require("path");
    const filePath = path.join(__dirname, "..", "storage", "pdfs", filename);
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error("Download error:", err);
        res.status(500).json({ error: "Failed to download PDF file" });
      }
    });
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ error: err.message });
  }
};
exports.borrowBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ error: "Book not found" });
    }

    // Check if the user has already borrowed the book
    const existingBorrow = await Inventory.findOne({
      user: req.user.id,
      book: req.params.id
    });

    if (existingBorrow) {
      return res.status(400).json({ error: "Book already borrowed" });
    }

    // Create a new borrow entry
    const newBorrow = new Inventory({
      user: req.user.id,
      book: req.params.id,
      ownershipType: "borrowed"
    });

    const newTransaction = new Transaction({
      user: req.user.id,
      book: req.params.id,
      type: "borrow",
      amount: 1,
      transactionDate: new Date()
    });

    await Promise.all([newBorrow.save(), newTransaction.save()]);
    res.status(201).json({ message: "Book borrowed successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
