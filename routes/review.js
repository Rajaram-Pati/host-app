

const express = require("express");
const wrapAsync = require("../utils/wrapAsync");
const router = express.Router({ mergeParams: true });

const Review = require("../models/review");
const Listing = require("../models/listing");

const { isLoggedIn, validateReview, isReviewAuthor, validateObjectId } = require("../middleware");

const reviewController = require("../controllers/reviews");

// ================= REVIEWS =================

// CREATE REVIEW
router.post(
  "/",
  validateObjectId,
  isLoggedIn,
  validateReview,
  wrapAsync(reviewController.createReview)
);

// DELETE REVIEW
router.delete(
  "/:reviewId",
  validateObjectId,
  isLoggedIn,
  isReviewAuthor,

  wrapAsync(reviewController.destroyReview)
);

module.exports = router;
