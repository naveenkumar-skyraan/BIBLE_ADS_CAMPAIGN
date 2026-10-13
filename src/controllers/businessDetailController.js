import businessDetailService from "../services/businessDetailService.js";

const businessDetailController = {
  async getCountries(req, res, next) {
    try {
      const countries = await businessDetailService.getCountryConfiguration();

      return res.status(200).json({
        success: true,
        count: countries.length,
        countries,
      });
    } catch (error) {
      next(error);
    }
  },

  async getCountryByCode(req, res, next) {
    try {
      const country = await businessDetailService.getCountryConfigurationByCode(
        req.params.country_code,
      );

      return res.status(200).json({
        success: true,
        country,
      });
    } catch (error) {
      next(error);
    }
  },

  async createBusiness(req, res, next) {
    try {
      const business = await businessDetailService.createBusiness(
        req.user.id,
        req.body,
      );

      return res.status(201).json({
        success: true,
        message: "Business details created successfully.",
        business,
      });
    } catch (error) {
      next(error);
    }
  },

  async getBusinesses(req, res, next) {
    try {
      const businesses = await businessDetailService.getBusinesses(req.user.id);

      return res.status(200).json({
        success: true,
        count: businesses.length,
        businesses,
      });
    } catch (error) {
      next(error);
    }
  },

  async getBusinessById(req, res, next) {
    try {
      const business = await businessDetailService.getBusinessById(
        req.user.id,
        Number(req.params.id),
      );

      return res.status(200).json({
        success: true,
        business,
      });
    } catch (error) {
      next(error);
    }
  },

  async updateBusiness(req, res, next) {
    try {
      const business = await businessDetailService.updateBusiness(
        req.user.id,
        Number(req.params.id),
        req.body,
      );

      return res.status(200).json({
        success: true,
        message: "Business details updated successfully.",
        business,
      });
    } catch (error) {
      next(error);
    }
  },

  async selectBusiness(req, res, next) {
    try {
      const business = await businessDetailService.selectBusiness(
        req.user.id,
        Number(req.params.id),
      );

      return res.status(200).json({
        success: true,
        message: "Business selected successfully.",
        business,
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteBusiness(req, res, next) {
    try {
      await businessDetailService.deleteBusiness(
        req.user.id,
        Number(req.params.id),
      );

      return res.status(200).json({
        success: true,
        message: "Business details deleted successfully.",
      });
    } catch (error) {
      next(error);
    }
  },
};

export default businessDetailController;
