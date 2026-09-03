/* 
const express = require("express");
const router = express.Router();

const wrapAsync = require("../utils/wrapAsync");

const {
  isLoggedIn,
  isHost,
  isOwner,
  normalizeListingBody,
  validateListing,
  validateObjectId,
} = require("../middleware");

const listingController = require("../controllers/listings");

// ================= VALIDATION MIDDLEWARE =================


// ================= INDEX =================
router.get(
  "/",
  wrapAsync(listingController.index)
);

// ================= NEW =================
router.get("/new", isLoggedIn,listingController.renderNewForm)
// ================= CREATE =================
router.post(
  "/",
  isLoggedIn,
  validateListing,
  wrapAsync(listingController.createListing)
);

// ================= SHOW =================
router.get("/:id", wrapAsync(listingController.showListing)
 );

// ================= EDIT =================


router.get("/:id/edit",isLoggedIn, isOwner, wrapAsync(listingController.renderEditForm)
);

// ================= UPDATE =================
router.put(
  "/:id",
  isLoggedIn, isOwner,
  validateListing,
  wrapAsync(listingController.updateListing)
);

// ================= DELETE =================
router.delete(
  "/:id",
  isLoggedIn, isOwner,
  wrapAsync(listingController.destroyListings)
);

module.exports = router;

 */



const express = require("express");
const router = express.Router();

const wrapAsync = require("../utils/wrapAsync");

const Listing = require("../models/listing");

const {
  isLoggedIn,
  isHost,
  isOwner,
  normalizeListingBody,
  validateListing,
  validateObjectId,
} = require("../middleware");

const listingController = require("../controllers/listings");
const multer = require("multer");
const { storage } = require("../cloudConfig");
const upload = multer({ storage });
const listingUploads = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "additionalPhoto1", maxCount: 1 },
  { name: "additionalPhoto2", maxCount: 1 },
]);

// ================= VALIDATION MIDDLEWARE =================


// ================= NEW =================
router.get(
  "/new",
  isLoggedIn,
  isHost,
  listingController.renderNewForm
);

// ================= COUNTRY SUGGESTIONS =================
router.get(
  "/search/countries",
  wrapAsync(listingController.countrySuggestions)
);

// ================= FILTER =================
router.get(
  "/filter/:category",
  wrapAsync(listingController.filterByCategory)
);

// ================= INDEX + CREATE =================
 router.route("/")
  .get(
    wrapAsync(listingController.index)
  )
  .post(
    isLoggedIn,
    isHost,
    listingUploads,
    normalizeListingBody,
    validateListing,
    wrapAsync(listingController.createListing)
  ); 
  

  
// ================= SHOW + UPDATE + DELETE =================
router.route("/:id")
  .all(validateObjectId)
  .get(
    wrapAsync(listingController.showListing)
  )
  .put(
    isLoggedIn,
    isHost,
    isOwner,
    listingUploads,
    normalizeListingBody,
    validateListing,
    wrapAsync(listingController.updateListing)
  )
  .delete(
    isLoggedIn,
    isHost,
    isOwner,
    wrapAsync(listingController.destroyListings)
  );

// ================= EDIT =================
router.get(
  "/:id/edit",
  validateObjectId,
  isLoggedIn,
  isHost,
  isOwner,
  wrapAsync(listingController.renderEditForm)
);

module.exports = router;

