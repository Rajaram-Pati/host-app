const Listing = require("../models/listing");
const Booking = require("../models/booking");
const categoryOptions = require("../utils/categories");
const { updateCompletedBookings } = require("./bookings");

const categoryValues = categoryOptions.map((category) => category.value);

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toPrice = (value) => {
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price : null;
};

const buildListingQuery = (filters) => {
  const query = { status: "approved" };

  if (filters.category && categoryValues.includes(filters.category)) {
    query.category = filters.category;
  }

  if (filters.country) {
    query.country = new RegExp(escapeRegex(filters.country.trim()), "i");
  }

  if (filters.minPrice || filters.maxPrice) {
    const minPrice = toPrice(filters.minPrice);
    const maxPrice = toPrice(filters.maxPrice);
    query.price = {};

    if (minPrice !== null) {
      query.price.$gte = minPrice;
    }

    if (maxPrice !== null) {
      query.price.$lte = maxPrice;
    }

    if (Object.keys(query.price).length === 0) {
      delete query.price;
    }
  }

  return query;
};

module.exports.index = async (req, res) => {
  const filters = {
    category: req.query.category,
    country: req.query.country,
    minPrice: req.query.minPrice,
    maxPrice: req.query.maxPrice,
  };
  const listings = await Listing.find(buildListingQuery(filters));

  res.render("listings/index.ejs", {
    allListings: listings,
    categoryOptions,
    activeCategory: filters.category || "",
    filters,
  });
};

module.exports.filterByCategory = async (req, res) => {
  const filters = {
    category: req.params.category,
    country: req.query.country,
    minPrice: req.query.minPrice,
    maxPrice: req.query.maxPrice,
  };
  const listings = await Listing.find(buildListingQuery(filters));

  res.render("listings/index.ejs", {
    allListings: listings,
    categoryOptions,
    activeCategory: filters.category,
    filters,
  });
};

module.exports.countrySuggestions = async (req, res) => {
  const searchText = (req.query.q || "").trim();
  const countryQuery = searchText
    ? { country: new RegExp(escapeRegex(searchText), "i") }
    : {};

  const countries = await Listing.distinct("country", {
    ...countryQuery,
    status: "approved",
  });
  const suggestions = countries
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 12);

  res.json({ countries: suggestions });
};

// new
module.exports.renderNewForm =  (req, res) => {
    res.render("listings/new.ejs", { categoryOptions });
};


// show 
module.exports.showListing =
  async (req, res) => {
      const { id } = req.params;
      await updateCompletedBookings();
  
      const listing = await Listing.findById(id).populate({
          path: "reviews",
          populate: {
              path: "author",
          },
      })
      
      .populate("owner");
  
      if (!listing) {
          req.flash("error", "Listing you requested does not exist!");
          return res.redirect("/listings");
      }

      const isOwner = req.user && listing.owner && listing.owner._id.equals(req.user._id);
      const isAdmin = req.user && ["admin", "superAdmin"].includes(req.user.role);

      if (listing.status !== "approved" && !isOwner && !isAdmin) {
          req.flash("error", "This listing is not public yet.");
          return res.redirect("/listings");
      }

      const reservations = await Booking.find({
          listing: listing._id,
          bookingStatus: { $in: ["Pending", "Confirmed"] },
      }).select("checkIn checkOut bookingStatus");

      const bookingRanges = reservations.map((booking) => ({
          checkIn: booking.checkIn.toISOString().slice(0, 10),
          checkOut: booking.checkOut.toISOString().slice(0, 10),
          status: booking.bookingStatus,
      }));
      
      res.render("listings/show.ejs", { listing, bookingRanges });
  
}

//create post
module.exports.createListing = async (req, res) => {
    const coverPhoto = req.files?.image?.[0];

    if (!coverPhoto) {
        req.flash("error", "Please upload a cover photo.");
        return res.redirect("/listings/new");
    }

    if (!req.body.listing.declaration) {
        req.flash("error", "Please accept the host declaration.");
        return res.redirect("/listings/new");
    }

    if (typeof req.body.listing.amenities === "string") {
        req.body.listing.amenities = req.body.listing.amenities
            .split(",")
            .map((amenity) => amenity.trim())
            .filter(Boolean);
    }

    const newListing = new Listing(req.body.listing);
    newListing.owner = req.user._id;
    newListing.status = "pending";
    newListing.rejectionReason = undefined;
    newListing.approvedBy = undefined;
    newListing.approvedAt = undefined;

    let url = coverPhoto.path;
    let filename = coverPhoto.filename;

    newListing.image = { url, filename };
    newListing.additionalImages = [
        ...(req.files?.additionalPhoto1 || []),
        ...(req.files?.additionalPhoto2 || []),
    ].map((file) => ({
        url: file.path,
        filename: file.filename,
    }));

    await newListing.save();

    req.flash("success", "Listing Submitted Successfully. Listing Pending Approval.");
    res.redirect(req.user.role === "host" ? "/host/dashboard" : "/listings");
};

  // edit
module.exports.renderEditForm = async (req, res) => {
    const { id } = req.params;

    const listing = await Listing.findById(id);

    if (!listing) {
        req.flash("error", "Listing you requested does not exist!");
        return res.redirect("/listings");
    }

    res.render("listings/edit.ejs", { listing, categoryOptions });
}  

//update 
module.exports.updateListing = async (req, res) => {
    let { id } = req.params;

    if (typeof req.body.listing.amenities === "string") {
        req.body.listing.amenities = req.body.listing.amenities
            .split(",")
            .map((amenity) => amenity.trim())
            .filter(Boolean);
    }

    let listing = await Listing.findById(id);

    if (!listing) {
        req.flash("error", "Listing you requested does not exist!");
        return res.redirect("/listings");
    }

    Object.assign(listing, req.body.listing);

    const coverPhoto = req.files?.image?.[0];
    if (coverPhoto) {
        let url = coverPhoto.path;
        let filename = coverPhoto.filename;

        listing.image = { url, filename };
    }

    const additionalUploads = [
        ...(req.files?.additionalPhoto1 || []),
        ...(req.files?.additionalPhoto2 || []),
    ];

    if (additionalUploads.length > 0) {
        listing.additionalImages = additionalUploads.map((file) => ({
            url: file.path,
            filename: file.filename,
        }));
    }

    if (req.user.role === "host") {
        listing.status = "pending";
        listing.approvedBy = undefined;
        listing.approvedAt = undefined;
        listing.rejectionReason = undefined;
        listing.rejectedBy = undefined;
        listing.rejectedAt = undefined;
    }

    await listing.save();

    req.flash("success", req.user.role === "host" ? "Listing updated and sent for approval." : "Listing Updated!");
    res.redirect(`/listings/${id}`);
};

  //delete
  module.exports.destroyListings = async (req, res) => {
      const { id } = req.params;
  
      const listing = await Listing.findByIdAndDelete(id);

      if (!listing) {
          req.flash("error", "Listing you requested does not exist!");
          return res.redirect("/listings");
      }
  
      req.flash("success", "Listing deleted successfully!");
  
      res.redirect("/listings");
    }
