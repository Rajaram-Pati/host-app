const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bookingSchema = new Schema({
  guest: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  host: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  listing: {
    type: Schema.Types.ObjectId,
    ref: "Listing",
    required: true,
  },
  checkIn: {
    type: Date,
    required: true,
  },
  checkOut: {
    type: Date,
    required: true,
  },
  totalGuests: {
    type: Number,
    required: true,
    min: 1,
  },
  totalNights: {
    type: Number,
    required: true,
    min: 1,
  },
  pricePerNight: {
    type: Number,
    required: true,
    min: 0,
  },
  cleaningFee: {
    type: Number,
    required: true,
    min: 0,
  },
  serviceFee: {
    type: Number,
    required: true,
    min: 0,
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  bookingStatus: {
    type: String,
    enum: ["Pending", "Confirmed", "Cancelled", "Completed"],
    default: "Pending",
  },
  paymentStatus: {
    type: String,
    enum: ["Pending", "Paid", "Refunded"],
    default: "Pending",
  },
  bookingDate: {
    type: Date,
    default: Date.now,
  },
  cancellationReason: {
    type: String,
    trim: true,
  },
  cancelledBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  cancelledAt: Date,
  specialRequest: {
    type: String,
    trim: true,
  },
}, { timestamps: true });

bookingSchema.index({ listing: 1, bookingStatus: 1, checkIn: 1, checkOut: 1 });

module.exports = mongoose.model("Booking", bookingSchema);
