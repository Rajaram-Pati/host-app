const Joi = require("joi");
const categoryOptions = require("./utils/categories");

const categoryValues = categoryOptions.map((category) => category.value);

module.exports.listingSchema = Joi.object({
    listing: Joi.object({

        title: Joi.string().required(),

        description: Joi.string().required(),

        location: Joi.string().required(),

        country: Joi.string().required(),

        price: Joi.number().required().min(0),

        category: Joi.string().valid(...categoryValues).required(),

        maxGuests: Joi.number().integer().min(1).required(),

        minStay: Joi.number().integer().min(1).required(),

        maxStay: Joi.number().integer().min(Joi.ref("minStay")).required(),

        bedrooms: Joi.number().integer().min(0).required(),

        bathrooms: Joi.number().integer().min(0).required(),

        amenities: Joi.alternatives().try(
            Joi.array().items(Joi.string().allow("", null)),
            Joi.string().allow("", null)
        ),

        contactPhone: Joi.string().required(),

        image: Joi.object({
            url: Joi.string().allow("", null),
            filename: Joi.string().allow("", null)
        }),

        declaration: Joi.any().valid("on").required()

    }).required()
});


module.exports.reviewSchema = Joi.object({
    review: Joi.object({

        comment: Joi.string().required(),

        rating: Joi.number()
            .required()
            .min(1)
            .max(5),

    }).required()
});
