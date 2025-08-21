const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  author: {
    type: String,
    required: true,
  },
  contentUrl: {
    type: String,
    required: true
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