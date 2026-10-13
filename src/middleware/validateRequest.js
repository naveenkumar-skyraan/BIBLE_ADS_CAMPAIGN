
const validateRequest = (schema, property = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((detail) => detail.message),
      });
    }

    if (property === "query") {
      res.locals.validatedQuery = value;
    } else if (property === "params") {
      req.validatedParams = value;
    } else {
      req.body = value;
    }

    next();
  };
};

export default validateRequest;
