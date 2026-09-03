if (process.env.NODE_ENV !== "production") {
  require("dotenv").config({ quiet: true });
}

//console.log(process.env.SECRET);

const express = require("express");
const app = express();

const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");

const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const flash = require("connect-flash");
const helmet = require("helmet");
const passport = require("passport");
const LocalStrategy = require("passport-local");

const User = require("./models/user");
const categoryOptions = require("./utils/categories");

// Routes
const listingsRouter = require("./routes/listings");
const reviewRouter = require("./routes/review");
const userRouter = require("./routes/user");
const hostRouter = require("./routes/host");
const adminRouter = require("./routes/admin");
const bookingRouter = require("./routes/bookings");

// Error utils
const ExpressError = require("./utils/ExpressError");

// ================= DATABASE =================
const dbUrl = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/wanderlust";

const dbConnectionPromise = mongoose
  .connect(dbUrl)
  .then((mongooseInstance) => {
    console.log("Connected to Local MongoDB");
    return mongooseInstance.connection.getClient();
  });

// ================= VIEW ENGINE =================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);
app.locals.categoryOptions = categoryOptions;
app.locals.activeCategory = "";
app.locals.filters = {};
app.locals.success = [];
app.locals.error = [];
app.locals.currentUser = null;

// ================= BASIC MIDDLEWARE =================
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));
app.use(helmet())

// ================= SESSION (MUST BE FIRST) =================

const store = MongoStore.create({
  clientPromise: dbConnectionPromise,
  crypto: {
    secret: process.env.SECRET,
  },
  touchAfter: 24 * 3600,
});

store.on("error", (err) => {
  console.log("Error in mongo session store", err);
});

const sessionOptions = {
  store,
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
  sameSite : "false"
};

app.use(session(sessionOptions));



// ================= PASSPORT =================
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// ================= FLASH =================
app.use(flash());

// ================= LOCALS =================
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currentUser = req.user;
  res.locals.categoryOptions = categoryOptions;
  res.locals.activeCategory = req.params.category || req.query.category || "";
  res.locals.filters = req.query || {};
  next();
});



// ================= ROUTES =================
app.use("/listings/:id/bookings", bookingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/listings", listingsRouter);
app.use("/bookings", bookingRouter);
app.use("/host", hostRouter);
app.use("/admin", adminRouter);
app.use("/", userRouter);

// ================= HOME =================
app.get("/", (req, res) => {
  res.redirect("/listings");
});

// ================= 404 =================
app.use((req, res, next) => {
    next(new ExpressError(404, "Page Not Found"));
});

// ================= ERROR HANDLER =================
app.use((err, req, res, next) => {
  console.error(err);
  let { statusCode = 500, message = "Something went wrong!" } = err;
  res.status(statusCode).render("error.ejs", { err });
});

// ================= SERVER =================
const port = process.env.PORT || 8098;

dbConnectionPromise
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("Database connection failed", err);
    process.exit(1);
  });
