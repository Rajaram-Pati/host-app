const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// FIX: handle both ESM + CommonJS exports safely
const passportLocalMongoose =
    require("passport-local-mongoose").default ||
    require("passport-local-mongoose");

const UserSchema = new Schema({
    fullName: {
        type: String,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
    },
    role: {
        type: String,
        enum: ["user", "host", "admin", "superAdmin"],
        default: "user",
    },
    hostRequestStatus: {
        type: String,
        enum: ["none", "pending", "approved", "rejected"],
        default: "none",
    },
    isSuspended: {
        type: Boolean,
        default: false,
    },
}, { timestamps: true });

// plugin must be a function
UserSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", UserSchema);
