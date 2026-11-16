
import {
    createPricingRule,
    getPricingRules,
    getPricingRuleById,
    updatePricingRule,
    updatePricingRuleStatus
} from "../models/adminPricingModel.js";

export const createAdminPricingRuleService = async (data) => {
    const id = await createPricingRule(data);

    return await getPricingRuleById(id);
};

export const getAdminPricingRulesService = async (filters) => {
    return await getPricingRules(filters);
};

export const getAdminPricingRuleByIdService = async (id) => {
    return await getPricingRuleById(id);
};

export const updateAdminPricingRuleService = async (id, data) => {
    const updated = await updatePricingRule(id, data);

    if (!updated) {
        return null;
    }

    return await getPricingRuleById(id);
};

export const updateAdminPricingRuleStatusService = async (id, is_active) => {
    const updated = await updatePricingRuleStatus(id, is_active);

    if (!updated) {
        return null;
    }

    return await getPricingRuleById(id);
};
