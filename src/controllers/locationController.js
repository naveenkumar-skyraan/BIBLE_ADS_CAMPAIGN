import locationService from "../services/locationService.js";

const locationController = {
  async getOptions(req, res, next) {
    try {
      const query =
        res.locals.validatedQuery ?? req.query;

      const options = await locationService.getOptions(
        query,
      );

      return res.status(200).json({
        success: true,
        country_code: String(
          query.country_code || "",
        ).toUpperCase(),
        field: query.field,
        parent_id:
          query.parent_id !== undefined &&
          query.parent_id !== ""
            ? Number(query.parent_id)
            : null,
        count: options.length,
        options,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default locationController;