/* let redirectUrl = res.locals.redirectUrl || "/listings";

res.redirect(redirectUrl); */

const User = require("../models/user");
const SUPER_ADMIN_EMAIL = "gayatrigayatriparida133@gmail.com";

// ================= SIGNUP FORM =================
module.exports.renderSignupForm = (req, res) => {
    res.render("users/signup.ejs");
};

// ================= SIGNUP =================
module.exports.signup = async (req, res, next) => {
    try {
        const body = req.body || {};
        const username = body.username && body.username.trim();
        const email = body.email && body.email.trim().toLowerCase();
        const password = body.password;

        if (!username || !email || !password) {
            req.flash("error", "Please fill username, email, and password.");
            return res.redirect("/signup");
        }

        const role = email === SUPER_ADMIN_EMAIL ? "superAdmin" : "user";
        const newUser = new User({ email, username, fullName: username, role });

        const registeredUser = await User.register(newUser, password);

        req.login(registeredUser, (err) => {
            if (err) return next(err);

            req.flash("success", "Welcome to WanderLust!");
            res.redirect(registeredUser.role === "superAdmin" ? "/admin/host-requests" : "/listings");
        });

    } catch (err) {
        req.flash("error", err.message);
        res.redirect("/signup");
    }
};

// ================= LOGIN FORM =================
module.exports.renderLoginForm = (req, res) => {
    res.render("users/login.ejs");
};

module.exports.validateLogin = (req, res, next) => {
    const body = req.body || {};
    const username = body.username && body.username.trim();
    const password = body.password;

    if (!username || !password) {
        req.flash("error", "Please enter username and password.");
        return res.redirect("/login");
    }

    req.body.username = username;
    next();
};

// ================= LOGIN =================
/* module.exports.login = (req, res) => {
    req.flash("success", "Welcome back to WanderLust!");

    let redirectUrl = res.locals.redirectUrl || "/listings";

    delete req.session.redirectUrl;

    res.redirect(redirectUrl);
};
 */
module.exports.login = (req, res) => {
    if (req.user.isSuspended) {
        return req.logout((err) => {
            if (err) return res.redirect("/login");
            req.flash("error", "Your account has been suspended.");
            res.redirect("/login");
        });
    }

    if (!req.user.role) {
        req.user.role = "user";
    }

    if (!req.user.hostRequestStatus) {
        req.user.hostRequestStatus = "none";
    }

    if (req.user.isModified("role") || req.user.isModified("hostRequestStatus")) {
        req.user.save().catch((err) => console.error("Failed to update user defaults", err));
    }

    req.flash("success", "Welcome back!");

    let redirectUrl = res.locals.redirectUrl;

    req.session.redirectUrl = null;

    if (!redirectUrl || redirectUrl.includes("reviews")) {
        if (req.user.role === "host") {
            redirectUrl = "/host/dashboard";
        } else if (req.user.role === "admin" || req.user.role === "superAdmin") {
            redirectUrl = "/admin/host-requests";
        } else {
            redirectUrl = "/listings";
        }
    }

    res.redirect(redirectUrl);
};

module.exports.profile = async (req, res) => {
    res.render("users/profile.ejs");
};

// ================= LOGOUT =================
module.exports.logout = (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);

        req.flash("success", "You are logged out!");
        res.redirect("/listings");
    });
};
