const Listing = require("../models/listing");
const User = require("../models/user");
const HostRequest = require("../models/hostRequest");

const SUPER_ADMIN_EMAIL = "gayatrigayatriparida133@gmail.com";

module.exports.hostRequests = async (req, res) => {
  const requests = await HostRequest.find({})
    .populate("user")
    .populate("reviewedBy")
    .sort({ createdAt: -1 });

  res.render("admin/host-requests.ejs", { requests });
};

module.exports.hostRequestDetails = async (req, res) => {
  const hostRequest = await HostRequest.findById(req.params.id)
    .populate("user")
    .populate("reviewedBy");

  if (!hostRequest) {
    req.flash("error", "Host Request not found.");
    return res.redirect("/admin/host-requests");
  }

  res.render("admin/host-request-show.ejs", { hostRequest });
};

module.exports.approveHostRequest = async (req, res) => {
  const hostRequest = await HostRequest.findById(req.params.id).populate("user");

  if (!hostRequest || !hostRequest.user) {
    req.flash("error", "Host Request not found.");
    return res.redirect("/admin/host-requests");
  }

  hostRequest.status = "approved";
  hostRequest.rejectionReason = undefined;
  hostRequest.reviewedBy = req.user._id;
  hostRequest.reviewedAt = new Date();
  await hostRequest.save();

  hostRequest.user.role = "host";
  hostRequest.user.hostRequestStatus = "approved";
  await hostRequest.user.save();

  req.flash("success", "Host Request Approved Successfully.");
  res.redirect("/admin/host-requests");
};

module.exports.rejectHostRequest = async (req, res) => {
  const hostRequest = await HostRequest.findById(req.params.id).populate("user");

  if (!hostRequest || !hostRequest.user) {
    req.flash("error", "Host Request not found.");
    return res.redirect("/admin/host-requests");
  }

  hostRequest.status = "rejected";
  hostRequest.rejectionReason = req.body.rejectionReason || "Not eligible at this time.";
  hostRequest.reviewedBy = req.user._id;
  hostRequest.reviewedAt = new Date();
  await hostRequest.save();

  hostRequest.user.hostRequestStatus = "rejected";
  await hostRequest.user.save();

  req.flash("success", "Host Request Rejected.");
  res.redirect("/admin/host-requests");
};

module.exports.listings = async (req, res) => {
  const listings = await Listing.find({})
    .populate("owner")
    .populate("approvedBy")
    .populate("rejectedBy")
    .sort({ createdAt: -1 });

  res.render("admin/listings.ejs", { listings });
};

module.exports.approveListing = async (req, res) => {
  const listing = await Listing.findById(req.params.id);

  if (!listing) {
    req.flash("error", "Listing not found.");
    return res.redirect("/admin/listings");
  }

  listing.status = "approved";
  listing.approvedBy = req.user._id;
  listing.approvedAt = new Date();
  listing.rejectionReason = undefined;
  listing.rejectedBy = undefined;
  listing.rejectedAt = undefined;
  await listing.save();

  req.flash("success", "Listing Approved Successfully.");
  res.redirect("/admin/listings");
};

module.exports.rejectListing = async (req, res) => {
  const listing = await Listing.findById(req.params.id);

  if (!listing) {
    req.flash("error", "Listing not found.");
    return res.redirect("/admin/listings");
  }

  listing.status = "rejected";
  listing.rejectionReason = req.body.rejectionReason || "Violates Policy";
  listing.rejectedBy = req.user._id;
  listing.rejectedAt = new Date();
  listing.approvedBy = undefined;
  listing.approvedAt = undefined;
  await listing.save();

  req.flash("success", "Listing Rejected Successfully.");
  res.redirect("/admin/listings");
};

module.exports.deleteListing = async (req, res) => {
  await Listing.findByIdAndDelete(req.params.id);
  req.flash("success", "Listing deleted successfully!");
  res.redirect("/admin/listings");
};

module.exports.users = async (req, res) => {
  const users = await User.find({}).sort({ createdAt: -1 });
  res.render("admin/users.ejs", { users });
};

module.exports.updateUser = async (req, res) => {
  const targetUser = await User.findById(req.params.id);

  if (!targetUser) {
    req.flash("error", "User not found.");
    return res.redirect("/admin/users");
  }

  const nextRole = req.body.role;

  if (req.user.role !== "superAdmin" && ["admin", "superAdmin"].includes(targetUser.role)) {
    req.flash("error", "Only the Super Admin can manage admin accounts.");
    return res.redirect("/admin/users");
  }

  const allowedRoles = req.user.role === "superAdmin"
    ? ["user", "host", "admin", "superAdmin"]
    : ["user", "host"];

  if (!allowedRoles.includes(nextRole)) {
    req.flash("error", "You do not have permission to set that role.");
    return res.redirect("/admin/users");
  }

  if (targetUser.role === "superAdmin" && nextRole !== "superAdmin") {
    const superAdminCount = await User.countDocuments({ role: "superAdmin" });
    if (superAdminCount <= 1) {
      req.flash("error", "Never allow deletion of the last remaining Super Admin.");
      return res.redirect("/admin/users");
    }
  }

  if (targetUser.email === SUPER_ADMIN_EMAIL && nextRole !== "superAdmin") {
    req.flash("error", "The default Super Admin account must remain Super Admin.");
    return res.redirect("/admin/users");
  }

  targetUser.role = nextRole;
  targetUser.isSuspended = req.body.isSuspended === "on";

  if (nextRole === "host") {
    targetUser.hostRequestStatus = "approved";
  }

  await targetUser.save();

  req.flash("success", "Role Updated Successfully.");
  res.redirect("/admin/users");
};
