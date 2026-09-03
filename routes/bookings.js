const express = require("express");
const router = express.Router({ mergeParams: true });

const wrapAsync = require("../utils/wrapAsync");
const bookingController = require("../controllers/bookings");
const { isLoggedIn, isHost, validateObjectId } = require("../middleware");

router.get(
  "/availability",
  validateObjectId,
  wrapAsync(bookingController.checkAvailability)
);

router.get(
  "/my-trips",
  isLoggedIn,
  wrapAsync(bookingController.myTrips)
);

router.post(
  "/",
  validateObjectId,
  isLoggedIn,
  wrapAsync(bookingController.createBooking)
);

router.get(
  "/:bookingId",
  validateObjectId,
  isLoggedIn,
  wrapAsync(bookingController.showBooking)
);

router.post(
  "/:bookingId/approve",
  validateObjectId,
  isLoggedIn,
  isHost,
  wrapAsync(bookingController.approveBooking)
);

router.post(
  "/:bookingId/reject",
  validateObjectId,
  isLoggedIn,
  isHost,
  wrapAsync(bookingController.rejectBooking)
);

router.post(
  "/:bookingId/cancel",
  validateObjectId,
  isLoggedIn,
  wrapAsync(bookingController.cancelBooking)
);

module.exports = router;
