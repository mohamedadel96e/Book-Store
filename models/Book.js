const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Please add a title"],
  },
  description: {
    type: String,
    required: [true, "Please add a description"],
  },
  author: {
    type: String,
    required: [true, "please add an author"],
  },
  contentUrl: {
    type: String, // Should be secured
    required: true,
  },
  coverImageUrl: {
    type: String,
  },
  type: {
    type: String,
    enum: ["novel", "short story", "poem", "essay", "comic", "other"], // you can expand
    required: true,
  },
  categories: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
  ],
  isPurchasable: {
    type: Boolean,
    default: true,
  },
  purchasePrice: {
    type: Number,
    default: 0,
    min: 0,
  },
  isBorrowable: {
    type: Boolean,
    default: true,
  },
  borrowDurationDays: {
    type: Number,
    default: 14,
    min: 1,
    max: 90,
  },

  pageCount: {
    type: Number,
    min: 1,
  },
  publishedDate: {
    type: Date,
  },
  isbn: {
    type: String,
    unique: true,
    sparse: true,
  },
  language: {
    type: String,
    default: "English",
  },

  rating: {
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalRatings: {
      type: Number,
      default: 0,
    },
  },
  tags: [
    {
      type: String,
      lowercase: true,
      trim: true,
    },
  ],

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for better performance
bookSchema.index({ title: 'text', author: 'text', description: 'text' });
bookSchema.index({ categories: 1 });
bookSchema.index({ type: 1 });
bookSchema.index({ isPurchasable: 1 });
bookSchema.index({ isBorrowable: 1 });
bookSchema.index({ createdAt: -1 });

// Virtual for formatted price
bookSchema.virtual('formattedPrice').get(function() {
  return this.purchasePrice ? `$${this.purchasePrice.toFixed(2)}` : 'Free';
});

// Method to increment download count
bookSchema.methods.incrementDownload = function() {
  this.downloadCount += 1;
  return this.save();
};

module.exports = mongoose.model('Book', bookSchema);