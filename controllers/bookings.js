const Booking = require("../models/booking");
const Listing = require("../models/listing");

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DEFAULT_MINIMUM_STAY = 1;
const DEFAULT_MAXIMUM_STAY = 30;

const startOfUtcDay = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const calculateNights = (checkIn, checkOut) => Math.round((checkOut - checkIn) / MS_PER_DAY);

const calculateBookingPrice = (pricePerNight, totalNights) => {
  const subtotal = pricePerNight * totalNights;
  const cleaningFee = Math.round(Math.max(499, pricePerNight * 0.08));
  const serviceFee = Math.round(subtotal * 0.12);

  return {
    cleaningFee,
    serviceFee,
    totalPrice: subtotal + cleaningFee + serviceFee,
  };
};

const formatDate = (date) => date.toLocaleDateString("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const formatInputDate = (date) => date.toISOString().slice(0, 10);

const findConfirmedOverlap = async (listingId, checkIn, checkOut, excludedBookingId = null) => {
  const query = {
    listing: listingId,
    bookingStatus: "Confirmed",
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn },
  };

  if (excludedBookingId) {
    query._id = { $ne: excludedBookingId };
  }

  return Booking.findOne(query).sort({ checkIn: 1 });
};

const findBlockingOverlap = async (listingId, checkIn, checkOut, excludedBookingId = null) => {
  const query = {
    listing: listingId,
    bookingStatus: { $in: ["Pending", "Confirmed"] },
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn },
  };

  if (excludedBookingId) {
    query._id = { $ne: excludedBookingId };
  }

  return Booking.findOne(query).sort({ checkIn: 1 });
};

const getListingForBooking = async (listingId) => {
  return Listing.findById(listingId).populate("owner");
};

const updateCompletedBookings = async () => {
  const today = startOfUtcDay(new Date());
  await Booking.updateMany(
    { bookingStatus: "Confirmed", checkOut: { $lt: today } },
    { $set: { bookingStatus: "Completed" } }
  );
};

const canManageBooking = (user, booking) => {
  if (!user || !booking) {
    return false;
  }

  const isAdmin = ["admin", "superAdmin"].includes(user.role);
  const isGuest = booking.guest && booking.guest._id
    ? booking.guest._id.equals(user._id)
    : booking.guest.equals(user._id);
  const isHost = booking.host && booking.host._id
    ? booking.host._id.equals(user._id)
    : booking.host.equals(user._id);

  return isAdmin || isGuest || isHost;
};

const validateBookingRequest = async ({ req, listing, checkIn, checkOut, totalGuests }) => {
  if (!listing) {
    return "Listing not found.";
  }

  if (listing.status !== "approved") {
    return "Cannot book pending or rejected listings.";
  }

  if (!listing.owner || listing.owner.isSuspended) {
    return "Cannot book suspended host properties.";
  }

  if (req.user && listing.owner._id.equals(req.user._id)) {
    return "Hosts cannot book their own property.";
  }

  if (!checkIn || !checkOut) {
    return "Please select valid check-in and check-out dates.";
  }

  const today = startOfUtcDay(new Date());
  if (checkIn < today) {
    return "Check-in date cannot be in the past.";
  }

  const totalNights = calculateNights(checkIn, checkOut);
  const minStay = listing.minStay || DEFAULT_MINIMUM_STAY;
  const maxStay = listing.maxStay || DEFAULT_MAXIMUM_STAY;

  if (totalNights < 1) {
    return "Check-out must be after check-in.";
  }

  if (totalNights < minStay) {
    return `Minimum stay is ${minStay} night${minStay === 1 ? "" : "s"}.`;
  }

  if (totalNights > maxStay) {
    return `Maximum stay is ${maxStay} nights.`;
  }

  if (!Number.isInteger(totalGuests) || totalGuests < 1) {
    return "Please select at least one guest.";
  }

  if (listing.maxGuests && totalGuests > listing.maxGuests) {
    return `This listing allows maximum ${listing.maxGuests} guests.`;
  }

  return null;
};

const loadBooking = async (bookingId) => Booking.findById(bookingId)
  .populate("guest")
  .populate("host")
  .populate("listing");

module.exports.checkAvailability = async (req, res) => {
  const listing = await getListingForBooking(req.params.id);
  const checkIn = startOfUtcDay(req.query.checkIn);
  const checkOut = startOfUtcDay(req.query.checkOut);
  const totalGuests = Number(req.query.totalGuests);
  const validationError = await validateBookingRequest({
    req,
    listing,
    checkIn,
    checkOut,
    totalGuests,
  });

  if (validationError) {
    return res.json({ available: false, message: validationError });
  }

  const conflictingBooking = await findBlockingOverlap(listing._id, checkIn, checkOut);

  if (conflictingBooking) {
    const statusText = conflictingBooking.bookingStatus === "Pending"
      ? "has a pending booking request"
      : "is already booked";

    return res.json({
      available: false,
      message: `This property ${statusText} from ${formatDate(conflictingBooking.checkIn)} to ${formatDate(conflictingBooking.checkOut)}.`,
      bookedFrom: formatInputDate(conflictingBooking.checkIn),
      bookedUntil: formatInputDate(conflictingBooking.checkOut),
      nextAvailableDate: formatInputDate(conflictingBooking.checkOut),
      nextAvailableLabel: formatDate(conflictingBooking.checkOut),
    });
  }

  return res.json({ available: true, message: "Dates are available." });
};

module.exports.createBooking = async (req, res) => {
  const listing = await getListingForBooking(req.params.id);
  const checkIn = startOfUtcDay(req.body.checkIn);
  const checkOut = startOfUtcDay(req.body.checkOut);
  const totalGuests = Number(req.body.totalGuests);
  const validationError = await validateBookingRequest({
    req,
    listing,
    checkIn,
    checkOut,
    totalGuests,
  });

  if (validationError) {
    req.flash("error", validationError);
    return res.redirect(`/listings/${req.params.id}`);
  }

  // Pending and confirmed bookings block new requests for the same date range.
  // Overlap exists when existing checkIn is before requested checkOut and
  // existing checkOut is after requested checkIn.
  const conflictingBooking = await findBlockingOverlap(listing._id, checkIn, checkOut);

  if (conflictingBooking) {
    const statusText = conflictingBooking.bookingStatus === "Pending"
      ? "has a pending booking request"
      : "is already booked";

    req.flash(
      "error",
      `This property ${statusText} from ${formatDate(conflictingBooking.checkIn)} to ${formatDate(conflictingBooking.checkOut)}. Available again from ${formatDate(conflictingBooking.checkOut)}.`
    );
    return res.redirect(`/listings/${req.params.id}`);
  }

  const totalNights = calculateNights(checkIn, checkOut);
  const pricePerNight = Number(listing.price || 0);
  const { cleaningFee, serviceFee, totalPrice } = calculateBookingPrice(pricePerNight, totalNights);

  const booking = new Booking({
    guest: req.user._id,
    host: listing.owner._id,
    listing: listing._id,
    checkIn,
    checkOut,
    totalGuests,
    totalNights,
    pricePerNight,
    cleaningFee,
    serviceFee,
    totalPrice,
    bookingStatus: "Pending",
    paymentStatus: "Pending",
    specialRequest: req.body.specialRequest,
  });

  await booking.save();

  req.flash("success", "Booking request submitted successfully.");
  res.redirect("/bookings/my-trips");
};

module.exports.myTrips = async (req, res) => {
  await updateCompletedBookings();

  const bookings = await Booking.find({ guest: req.user._id })
    .populate("host")
    .populate("listing")
    .sort({ checkIn: -1 });

  res.render("bookings/my-trips.ejs", { bookings });
};

module.exports.showBooking = async (req, res) => {
  await updateCompletedBookings();

  const booking = await loadBooking(req.params.bookingId);

  if (!booking || !canManageBooking(req.user, booking)) {
    req.flash("error", "Booking not found.");
    return res.redirect("/listings");
  }

  res.render("bookings/show.ejs", { booking });
};

module.exports.approveBooking = async (req, res) => {
  const booking = await loadBooking(req.params.bookingId);

  if (!booking || !booking.host._id.equals(req.user._id)) {
    req.flash("error", "You cannot approve this booking.");
    return res.redirect("/host/dashboard");
  }

  if (booking.bookingStatus !== "Pending") {
    req.flash("error", "Only pending bookings can be approved.");
    return res.redirect("/host/dashboard");
  }

  const conflictingBooking = await findConfirmedOverlap(
    booking.listing._id,
    booking.checkIn,
    booking.checkOut,
    booking._id
  );

  if (conflictingBooking) {
    req.flash(
      "error",
      `Cannot confirm this request because it overlaps a confirmed booking from ${formatDate(conflictingBooking.checkIn)} to ${formatDate(conflictingBooking.checkOut)}.`
    );
    return res.redirect("/host/dashboard");
  }

  booking.bookingStatus = "Confirmed";
  booking.cancellationReason = undefined;
  await booking.save();

  req.flash("success", "Booking confirmed successfully.");
  res.redirect("/host/dashboard");
};

module.exports.rejectBooking = async (req, res) => {
  const booking = await loadBooking(req.params.bookingId);

  if (!booking || !booking.host._id.equals(req.user._id)) {
    req.flash("error", "You cannot reject this booking.");
    return res.redirect("/host/dashboard");
  }

  if (!["Pending", "Confirmed"].includes(booking.bookingStatus)) {
    req.flash("error", "This booking can no longer be rejected.");
    return res.redirect("/host/dashboard");
  }

  booking.bookingStatus = "Cancelled";
  booking.cancellationReason = req.body.cancellationReason || "Cancelled by host.";
  booking.cancelledBy = req.user._id;
  booking.cancelledAt = new Date();
  await booking.save();

  req.flash("success", "Booking cancelled successfully.");
  res.redirect("/host/dashboard");
};

module.exports.cancelBooking = async (req, res) => {
  const booking = await loadBooking(req.params.bookingId);

  if (!booking || !canManageBooking(req.user, booking)) {
    req.flash("error", "You cannot cancel this booking.");
    return res.redirect("/bookings/my-trips");
  }

  if (!["Pending", "Confirmed"].includes(booking.bookingStatus)) {
    req.flash("error", "This booking cannot be cancelled.");
    return res.redirect(`/bookings/${req.params.bookingId}`);
  }

  const isAdmin = ["admin", "superAdmin"].includes(req.user.role);
  const isHost = booking.host._id.equals(req.user._id);
  const today = startOfUtcDay(new Date());

  if (!isAdmin && !isHost && booking.checkIn <= today) {
    req.flash("error", "Guests may cancel only before the check-in date.");
    return res.redirect(`/bookings/${req.params.bookingId}`);
  }

  booking.bookingStatus = "Cancelled";
  booking.cancellationReason = req.body.cancellationReason || "Cancelled by guest.";
  booking.cancelledBy = req.user._id;
  booking.cancelledAt = new Date();
  await booking.save();

  req.flash("success", "Booking cancelled successfully.");

  if (isAdmin) {
    return res.redirect("/admin/bookings");
  }

  if (isHost) {
    return res.redirect("/host/dashboard");
  }

  res.redirect("/bookings/my-trips");
};

module.exports.adminBookings = async (req, res) => {
  await updateCompletedBookings();

  const today = startOfUtcDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const [
    bookings,
    totalBookings,
    pendingBookings,
    confirmedBookings,
    cancelledBookings,
    completedBookings,
    todaysBookings,
    mostBookedListings,
    topHosts,
  ] = await Promise.all([
    Booking.find({})
      .populate("guest")
      .populate("host")
      .populate("listing")
      .sort({ createdAt: -1 }),
    Booking.countDocuments({}),
    Booking.countDocuments({ bookingStatus: "Pending" }),
    Booking.countDocuments({ bookingStatus: "Confirmed" }),
    Booking.countDocuments({ bookingStatus: "Cancelled" }),
    Booking.countDocuments({ bookingStatus: "Completed" }),
    Booking.countDocuments({ bookingDate: { $gte: today, $lt: tomorrow } }),
    Booking.aggregate([
      { $group: { _id: "$listing", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: "listings", localField: "_id", foreignField: "_id", as: "listing" } },
      { $unwind: "$listing" },
    ]),
    Booking.aggregate([
      { $group: { _id: "$host", count: { $sum: 1 }, revenue: { $sum: "$totalPrice" } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "host" } },
      { $unwind: "$host" },
    ]),
  ]);

  res.render("admin/bookings.ejs", {
    bookings,
    mostBookedListings,
    topHosts,
    stats: {
      totalBookings,
      pendingBookings,
      confirmedBookings,
      cancelledBookings,
      completedBookings,
      todaysBookings,
    },
  });
};

module.exports.bookingPrice = calculateBookingPrice;
module.exports.findConfirmedOverlap = findConfirmedOverlap;
module.exports.findBlockingOverlap = findBlockingOverlap;
module.exports.updateCompletedBookings = updateCompletedBookings;
module.exports.formatDate = formatDate;
