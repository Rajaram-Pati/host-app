const Listing = require("../models/listing");
const HostRequest = require("../models/hostRequest");
const Booking = require("../models/booking");
const { updateCompletedBookings } = require("./bookings");

module.exports.renderHostRequestForm = async (req, res) => {
  const existingRequest = await HostRequest.findOne({ user: req.user._id }).sort({ createdAt: -1 });
  res.render("host/request.ejs", { existingRequest });
};

module.exports.submitHostRequest = async (req, res) => {
  if (!req.file) {
    req.flash("error", "Please upload one Government ID image.");
    return res.redirect("/host/request");
  }

  if (!req.body.confirmInfo) {
    req.flash("error", "Please confirm the host declaration before submitting.");
    return res.redirect("/host/request");
  }

  const pendingRequest = await HostRequest.findOne({
    user: req.user._id,
    status: "pending",
  });

  if (pendingRequest) {
    req.flash("error", "You already have a pending Host Request.");
    return res.redirect("/profile");
  }

  const hostRequest = new HostRequest({
    user: req.user._id,
    fullName: req.body.fullName,
    phone: req.body.phone,
    city: req.body.city,
    state: req.body.state,
    country: req.body.country,
    reason: req.body.reason,
    governmentIdNumber: req.body.governmentIdNumber,
    governmentIdImage: {
      url: req.file.path,
      filename: req.file.filename,
    },
  });

  await hostRequest.save();

  req.user.hostRequestStatus = "pending";
  await req.user.save();

  req.flash("success", "Host Request Submitted Successfully.");
  res.redirect("/profile");
};

module.exports.dashboard = async (req, res) => {
  await updateCompletedBookings();

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const [
    totalListings,
    pendingListings,
    approvedListings,
    rejectedListings,
    listings,
    bookings,
    totalBookings,
    pendingBookings,
    confirmedBookings,
    cancelledBookings,
    completedBookings,
    upcomingGuests,
    upcomingCheckIns,
    upcomingCheckOuts,
    revenueAgg,
  ] = await Promise.all([
    Listing.countDocuments({ owner: req.user._id }),
    Listing.countDocuments({ owner: req.user._id, status: "pending" }),
    Listing.countDocuments({ owner: req.user._id, status: "approved" }),
    Listing.countDocuments({ owner: req.user._id, status: "rejected" }),
    Listing.find({ owner: req.user._id }).sort({ createdAt: -1 }),
    Booking.find({ host: req.user._id })
      .populate("guest")
      .populate("listing")
      .sort({ createdAt: -1 }),
    Booking.countDocuments({ host: req.user._id }),
    Booking.countDocuments({ host: req.user._id, bookingStatus: "Pending" }),
    Booking.countDocuments({ host: req.user._id, bookingStatus: "Confirmed" }),
    Booking.countDocuments({ host: req.user._id, bookingStatus: "Cancelled" }),
    Booking.countDocuments({ host: req.user._id, bookingStatus: "Completed" }),
    Booking.countDocuments({ host: req.user._id, bookingStatus: "Confirmed", checkIn: { $gte: today } }),
    Booking.countDocuments({ host: req.user._id, bookingStatus: "Confirmed", checkIn: { $gte: today, $lt: tomorrow } }),
    Booking.countDocuments({ host: req.user._id, bookingStatus: "Confirmed", checkOut: { $gte: today, $lt: tomorrow } }),
    Booking.aggregate([
      { $match: { host: req.user._id, bookingStatus: { $in: ["Confirmed", "Completed"] } } },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]),
  ]);

  res.render("host/dashboard.ejs", {
    stats: {
      totalListings,
      pendingListings,
      approvedListings,
      rejectedListings,
      totalBookings,
      pendingBookings,
      confirmedBookings,
      cancelledBookings,
      completedBookings,
      upcomingGuests,
      upcomingCheckIns,
      upcomingCheckOuts,
      estimatedRevenue: revenueAgg[0]?.total || 0,
    },
    listings,
    bookings,
  });
};
