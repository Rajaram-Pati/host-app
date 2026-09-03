const Listing = require("./models/listing");
const Review = require("./models/review");
const Booking = require("./models/booking");
const ExpressError = require("./utils/ExpressError");
const { listingSchema,reviewSchema } = require("./schema");
const mongoose = require("mongoose");

const getListingRedirectUrl = (req) => {
  if (req.params?.id) {
    return `/listings/${req.params.id}`;
  }

  if (req.method === "GET") {
    return req.originalUrl;
  }

  return "/listings";
};

module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.session.redirectUrl = getListingRedirectUrl(req);
    req.flash("error", "You must be logged in.");
    return res.redirect("/login");
  }

  next();
};

module.exports.saveRedirectUrl = (req, res, next) => {
    if (req.session.redirectUrl) {
        res.locals.redirectUrl = req.session.redirectUrl;
    }
    next();
};

module.exports.isOwner = async (req, res, next) => {
    let { id } = req.params;

    let listing = await Listing.findById(id);

    if (!listing) {
        req.flash("error", "Listing you requested does not exist!");
        return res.redirect("/listings");
    }

    const canManageAnyListing = ["admin", "superAdmin"].includes(req.user.role);

    if (!canManageAnyListing && (!listing.owner || !listing.owner.equals(req.user._id))) {
        req.flash("error", "You are not the owner of this listing!");
        return res.redirect(`/listings/${id}`);
    }

    next();
};

const hasRole = (user, roles) => user && roles.includes(user.role);

module.exports.isHost = (req, res, next) => {
  if (!hasRole(req.user, ["host", "admin", "superAdmin"])) {
    req.flash("error", "You need an approved host account to do that.");
    return res.redirect("/listings");
  }

  next();
};

module.exports.isAdmin = (req, res, next) => {
  if (!hasRole(req.user, ["admin", "superAdmin"])) {
    req.flash("error", "You do not have permission to access that page.");
    return res.redirect("/listings");
  }

  next();
};

module.exports.isSuperAdmin = (req, res, next) => {
  if (!hasRole(req.user, ["superAdmin"])) {
    req.flash("error", "Only the Super Admin can do that.");
    return res.redirect("/admin");
  }

  next();
};

module.exports.isBookingGuest = async (req, res, next) => {
  const booking = await Booking.findById(req.params.bookingId);

  if (!booking) {
    req.flash("error", "Booking not found.");
    return res.redirect("/listings");
  }

  if (!booking.guest.equals(req.user._id)) {
    req.flash("error", "You cannot modify another user's booking.");
    return res.redirect("/listings");
  }

  req.booking = booking;
  next();
};

module.exports.validateObjectId = (req, res, next) => {
  const ids = [req.params.id, req.params.reviewId, req.params.bookingId].filter(Boolean);

  if (ids.some((id) => !mongoose.isValidObjectId(id))) {
    req.flash("error", "Invalid page requested.");
    return res.redirect("/listings");
  }

  next();
};

module.exports.isReviewAuthor = async (req, res, next) => {
    let { reviewId, id } = req.params;

    let review = await Review.findById(reviewId);

    if (!review) {
        req.flash("error", "Review does not exist!");
        return res.redirect(`/listings/${id}`);
    }

    if (!review.author || !review.author.equals(req.user._id)) {
        req.flash("error", "You are not the author of this review!");
        return res.redirect(`/listings/${id}`);
    }

    next();
};

module.exports.normalizeListingBody = (req, res, next) => {
  req.body = req.body || {};
  req.body.listing = req.body.listing || {};

  for (let key of Object.keys(req.body)) {
    const bracketMatch = key.match(/^listing\[(.+)\]$/);
    const dotMatch = key.match(/^listing\.(.+)$/);
    const listingKey = bracketMatch?.[1] || dotMatch?.[1];

    if (listingKey) {
      req.body.listing[listingKey] = req.body[key];
      delete req.body[key];
    }
  }

  next();
};

module.exports.validateListing = (req, res, next) => {
  let { error } = listingSchema.validate(req.body);

  if (error) {
    let msg = error.details.map((el) => el.message).join(",");
    req.flash("error", msg);
    const fallbackUrl = req.originalUrl.includes("_method=PUT")
      ? req.get("Referrer") || "/listings"
      : "/listings/new";
    return res.redirect(fallbackUrl);
  }

  next();
};

module.exports.validateReview = (req, res, next) => {
  let { error } = reviewSchema.validate(req.body);

  if (error) {
    let msg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(400, msg);
  }

  next();
};
