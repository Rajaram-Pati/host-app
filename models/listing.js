const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review=require("./review")
const categoryOptions = require("../utils/categories");

const categoryValues = categoryOptions.map((category) => category.value);

const listingSchema = new Schema({
  title: {
    type: String,
    required: true,
  },

  description: String,

  image: {
    url: String,
    filename: String,
  },
  additionalImages: [
    {
      url: String,
      filename: String,
    },
  ],
  price: Number,
  location: String,
  country: String,
  category: {
    type: String,
    enum: categoryValues,
    required: true,
    default: "trending",
  },

  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Review",
    },
  ],

  owner: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
  maxGuests: Number,
  minStay: {
    type: Number,
    default: 1,
    min: 1,
  },
  maxStay: {
    type: Number,
    default: 30,
    min: 1,
  },
  bedrooms: Number,
  bathrooms: Number,
  amenities: [String],
  contactPhone: String,
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  approvedAt: Date,
  rejectionReason: String,
  rejectedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  rejectedAt: Date,
}, { timestamps: true });
listingSchema.post("findOneAndDelete", async (listing)=>{
    if(listing){
          await Review.deleteMany({_id: {$in: listing.reviews}})
    }
  
});

module.exports = mongoose.model("Listing", listingSchema);
