const express = require("express");
const router = express.Router();
const multer = require("multer");

const { storage } = require("../cloudConfig");
const upload = multer({ storage });
const wrapAsync = require("../utils/wrapAsync");
const hostController = require("../controllers/host");
const { isLoggedIn, isHost } = require("../middleware");

router.get("/request", isLoggedIn, wrapAsync(hostController.renderHostRequestForm));

router.post(
  "/request",
  isLoggedIn,
  upload.single("governmentIdImage"),
  wrapAsync(hostController.submitHostRequest)
);

router.get("/dashboard", isLoggedIn, isHost, wrapAsync(hostController.dashboard));

module.exports = router;
