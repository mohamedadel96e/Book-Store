const mongoose = require('mongoose');

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
    type: String
  },
  type: {
    type: String,
    enum: ['novel', 'short story', 'poem', 'essay', 'comic', 'other'], // you can expand
    required: true
  },
  categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  isPurchasable: {
    type: Boolean,
    default: true
  },
  purchasePrice: {
    type: Number,
    default: 0,
    min: 0
  },
  isBorrowable: {
    type: Boolean,
    default: true
  },
  borrowDurationDays: {
    type: Number,
    min: 1
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Book', bookSchema);