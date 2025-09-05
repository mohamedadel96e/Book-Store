const e = require("express");
const mongoose = require("mongoose");
const Book = require("../models/Book");
const Category = require("../models/Category");
const asyncHandler = require("express-async-handler");
const fs = require("fs");
const path = require("path");

const Inventory = require("../models/Inventory");
const Transaction = require("../models/Transaction");
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

// @desc    Get all books
// @route   GET /api/books
// @access  Public
exports.getBooks = asyncHandler(async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;

    let query = {};

    // Filter by category - handle both ObjectId and category name
    if (req.query.category) {
      // Check if it's a valid ObjectId
      if (mongoose.Types.ObjectId.isValid(req.query.category)) {
        query.categories = req.query.category;
      } else {
        // If not ObjectId, search by category name
        const categoryDoc = await Category.findOne({ 
          name: { $regex: new RegExp(req.query.category, 'i') } 
        });
        if (categoryDoc) {
          query.categories = categoryDoc._id;
        } else {
          // If category not found, return empty results
          return res.json({
            books: [],
            totalPages: 0,
            currentPage: page,
            total: 0,
          });
        }
      }
    }

    // Filter by type
    if (req.query.type) {
      query.type = req.query.type;
    }

    // Search functionality
    if (req.query.search) {
      query.$text = {$search: req.query.search};
    }

    // Filter by purchasable/borrowable
    if (req.query.purchasable !== undefined) {
      query.isPurchasable = req.query.purchasable === "true";
    }

    if (req.query.borrowable !== undefined) {
      query.isBorrowable = req.query.borrowable === "true";
    }

    const total = await Book.countDocuments(query);
    const books = await Book.find(query)
      .populate("categories", "name description")
      .sort({createdAt: -1})
      .limit(limit * 1)
      .skip(startIndex)
      .select("-contentUrl"); // Don't expose direct file URLs in listings

    res.json({
      books,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});
exports.getBookById = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id)
    .populate("categories", "name description")
    .select("-contentUrl"); // Don't expose direct file URL

  if (!book) {
    res.status(404);
    throw new Error("Book not found");
  }

  res.json(book);
});
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

    const populatedBook = await Book.findById(newBook._id)
      .populate("categories", "name description")
      .select("-contentUrl");
    res.status(201).json(populatedBook);
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

// @desc    Download book file
// @route   GET /api/books/:id/download
// @access  Private (requires book access)
exports.downloadBook = asyncHandler(async (req, res) => {
  try {
    const bookId = req.params.id;
    // Check if user has access to this book (middleware should handle this)
    const book = await Book.findById(bookId);

    if (!book) {
      return res.status(404).json({error: "Book not found"});
    }

    const filePath = path.join(__dirname, "..", book.contentUrl);
    // Check if file exists
    if (!book.contentUrl || !fs.existsSync(filePath)) {
      return res.status(404).json({error: "Book content not found"});
    }

    // Increment download count
    await book.incrementDownload();

    // Set appropriate headers
    const filename = path.basename(book.contentUrl);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${book.title}.pdf"`
    );
    res.setHeader("Content-Type", "application/pdf");

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// @desc    Stream book file (for both purchased and borrowed books)
// @route   GET /api/books/:id/stream
// @access  Private (requires book access - purchased, borrowed, or subscription)
exports.streamBook = asyncHandler(async (req, res) => {
  try {
    const bookId = req.params.id;
    const book = await Book.findById(bookId);

    if (!book) {
      return res.status(404).json({error: "Book not found"});
    }

    const filePath = path.join(__dirname, "..", book.contentUrl);
    // Check if file exists
    if (!book.contentUrl || !fs.existsSync(filePath)) {
      return res.status(404).json({error: "Book content not found"});
    }

    // Get file stats for streaming
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // Handle range requests for partial content (useful for large PDFs)
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Content-Length", chunksize);
      res.setHeader("Content-Type", "application/pdf");

      const fileStream = fs.createReadStream(filePath, { start, end });
      fileStream.pipe(res);
    } else {
      // Full file streaming
      res.setHeader("Content-Length", fileSize);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Accept-Ranges", "bytes");
      
      // Set inline disposition for streaming (not download)
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${book.title}.pdf"`
      );

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    }

    // Increment view count for streaming
    await book.incrementView();
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// @desc    Get book cover image
// @route   GET /api/books/:id/cover
// @access  Public
exports.getBookCover = asyncHandler(async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      res.status(404);
      throw new Error("Book not found");
    }

    if (!book.coverImageUrl || !fs.existsSync(book.coverImageUrl)) {
      res.status(404);
      throw new Error("Cover image not found");
    }

    // Set appropriate headers
    const ext = path.extname(book.coverImageUrl).toLowerCase();
    const mimeTypes = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };

    res.setHeader("Content-Type", mimeTypes[ext] || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400"); // Cache for 1 day

    // Stream the image
    const imageStream = fs.createReadStream(book.coverImageUrl);
    imageStream.pipe(res);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// @desc    Rate a book
// @route   POST /api/books/:id/rate
// @access  Private
exports.rateBook = asyncHandler(async (req, res) => {
  try {
    const {rating} = req.body;

    if (!rating || rating < 1 || rating > 5) {
      res.status(400);
      throw new Error("Rating must be between 1 and 5");
    }

    const book = await Book.findById(req.params.id);
    if (!book) {
      res.status(404);
      throw new Error("Book not found");
    }

    // Calculate new average rating
    const currentTotal =
      book.rating.averageRating * book.rating.totalRatings;
    const newTotal = currentTotal + rating;
    const newCount = book.rating.totalRatings + 1;
    const newAverage = newTotal / newCount;

    book.rating.averageRating = Math.round(newAverage * 10) / 10; // Round to 1 decimal
    book.rating.totalRatings = newCount;

    await book.save();

    res.json({
      message: "Rating submitted successfully",
      newRating: {
        averageRating: book.rating.averageRating,
        totalRatings: book.rating.totalRatings,
      },
    });
  } catch (error) {
    res.status(400).json({error: error.message});
  }
});

// @desc    Search books
// @route   GET /api/books/search
// @access  Public
exports.searchBooks = asyncHandler(async (req, res) => {
  try {
    const {q, category, type, author, minRating} = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;

    let query = {};

    // Text search
    if (q) {
      query.$text = {$search: q};
    }

    // Category filter - handle both ObjectId and category name
    if (category) {
      // Check if it's a valid ObjectId
      if (mongoose.Types.ObjectId.isValid(category)) {
        query.categories = category;
      } else {
        // If not ObjectId, search by category name
        const categoryDoc = await Category.findOne({ 
          name: { $regex: new RegExp(category, 'i') } 
        });
        if (categoryDoc) {
          query.categories = categoryDoc._id;
        } else {
          // If category not found, return empty results
          return res.json({
            books: [],
            totalPages: 0,
            currentPage: page,
            total: 0,
          });
        }
      }
    }

    if (type) {
      query.type = type;
    }

    if (author) {
      query.author = {$regex: author, $options: "i"};
    }

    if (minRating) {
      query["rating.averageRating"] = {$gte: parseFloat(minRating)};
    }
    
    const total = await Book.countDocuments(query);
    const books = await Book.find(query)
      .populate("categories", "name")
      .select("-contentUrl")
      .sort(q ? {score: {$meta: "textScore"}} : {createdAt: -1})
      .limit(limit * 1)
      .skip(startIndex);

    res.json({
      books,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});
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
