const express = require("express");
const router = express.Router();

const wrapAsync = require("../utils/wrapAsync");
const adminController = require("../controllers/admin");
const bookingController = require("../controllers/bookings");
const { isLoggedIn, isAdmin, isSuperAdmin, validateObjectId } = require("../middleware");

router.use(isLoggedIn, isAdmin);

router.get("/", (req, res) => {
  res.redirect("/admin/host-requests");
});

router.get("/host-requests", wrapAsync(adminController.hostRequests));

router.get(
  "/host-requests/:id",
  validateObjectId,
  wrapAsync(adminController.hostRequestDetails)
);

router.post(
  "/host-requests/:id/approve",
  validateObjectId,
  wrapAsync(adminController.approveHostRequest)
);

router.post(
  "/host-requests/:id/reject",
  validateObjectId,
  wrapAsync(adminController.rejectHostRequest)
);

router.get("/listings", wrapAsync(adminController.listings));

router.get("/bookings", wrapAsync(bookingController.adminBookings));

router.post(
  "/listings/:id/approve",
  validateObjectId,
  wrapAsync(adminController.approveListing)
);

router.post(
  "/listings/:id/reject",
  validateObjectId,
  wrapAsync(adminController.rejectListing)
);

router.post(
  "/listings/:id/delete",
  validateObjectId,
  wrapAsync(adminController.deleteListing)
);

router.get("/users", wrapAsync(adminController.users));

router.post(
  "/users/:id",
  validateObjectId,
  wrapAsync(adminController.updateUser)
);

module.exports = router;
