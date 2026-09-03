/* const express = require("express");
const router = express.Router();
const User = require("../models/user");

router.get("/signup", (req,res)=>{
    res.render("users/signup.ejs");
});

// login
router.get("/login", (req, res) => {
    res.render("users/login.ejs");
});
const passport = require("passport");
//const { storeReturnTo, saveRedirectUrl } = require("../middleware");
const {saveRedirectUrl} = require("../middleware");

router.post("/signup", async (req, res, next) => {
    try {
        const { username, email, password } = req.body;

        const newUser = new User({ email, username });

        const registeredUser = await User.register(newUser, password);

        // AUTO LOGIN AFTER SIGNUP
        req.login(registeredUser, (err) => {
            if (err) return next(err);

            req.flash("success", "Welcome to WanderLust!");
            res.redirect("/listings");
        });

    } catch (err) {
        req.flash("error", err.message);
        res.redirect("/signup");
    }
});




router.post(
    "/login",
    saveRedirectUrl,
    passport.authenticate("local", {
        failureRedirect: "/login",
        failureFlash: true,
    }),
    (req, res) => {

       
        req.flash("success", "welcome back to wanderlust");
      let redirectUrl = res.locals.redirectUrl || "/listings";

        delete req.session.redirectUrl;

        return res.redirect(redirectUrl);
    }
);

router.get("/logout", (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }

        req.flash("success", "You are logged out!");
        res.redirect("/listings");
    });
});

module.exports = router; */

const express = require("express");
const router = express.Router();
const passport = require("passport");

const userController = require("../controllers/users");
const { isLoggedIn, saveRedirectUrl } = require("../middleware");

/* // ================= SIGNUP =================
router.get("/signup", userController.renderSignupForm);

router.post("/signup", userController.signup);

// ================= LOGIN =================
router.get("/login", userController.renderLoginForm);

router.post(
    "/login",
    saveRedirectUrl,
    passport.authenticate("local", {
        failureRedirect: "/login",
        failureFlash: true,
    }),
    userController.login
);

// ================= LOGOUT =================
router.get("/logout", userController.logout);

module.exports = router; */


// ================= SIGNUP =================
router.route("/signup")
    .get(userController.renderSignupForm)
    .post(userController.signup);

// ================= LOGIN =================
router.route("/login")
    .get(userController.renderLoginForm)
    .post(
        userController.validateLogin,
        saveRedirectUrl,
        passport.authenticate("local", {
            failureRedirect: "/login",
            failureFlash: true,
        }),
        userController.login
    );

// ================= LOGOUT =================
router.get("/logout", userController.logout);

router.get("/profile", isLoggedIn, userController.profile);

module.exports = router;

