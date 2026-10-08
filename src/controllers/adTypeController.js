import * as service from "../services/adTypeService.js";

import {
    createAdTypeSchema,
    updateAdTypeSchema,
    updateAdTypeStatusSchema
} from "../validators/adTypeValidator.js";

const validate = (schema, body) => {
    const { error, value } = schema.validate(body, {
        abortEarly: false,
        stripUnknown: true
    });

    if (!error) {
        return { value };
    }

    const errors = {};

    for (const detail of error.details) {
        const field = detail.path[0];

        if (!errors[field]) {
            errors[field] = detail.message;
        }
    }

    return { errors };
};

const handleError = (res, error) => {
    console.error("AD TYPE ERROR:", error);

    return res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode
            ? error.message
            : "Internal server error."
    });
};

export const createTypeController = async (req, res) => {
    const result = validate(createAdTypeSchema, req.body);

    if (result.errors) {
        return res.status(400).json({
            success: false,
            message: "Validation failed.",
            errors: result.errors
        });
    }

    try {
        const data = await service.createType(result.value);

        return res.status(201).json({
            success: true,
            message: "Ad type created successfully.",
            data
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listTypesController = async (req, res) => {
    try {
        const includeInactive =
            req.query.include_inactive !== "false";

        const data = await service.listTypes(includeInactive);

        return res.status(200).json({
            success: true,
            message: "Ad types fetched successfully.",
            data
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getTypeController = async (req, res) => {
    try {
        const data = await service.getType(req.params.id);

        return res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const updateTypeController = async (req, res) => {
    const result = validate(updateAdTypeSchema, req.body);

    if (result.errors) {
        return res.status(400).json({
            success: false,
            message: "Validation failed.",
            errors: result.errors
        });
    }

    try {
        const data = await service.editType(
            req.params.id,
            result.value
        );

        return res.status(200).json({
            success: true,
            message: "Ad type updated successfully.",
            data
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const updateTypeStatusController = async (req, res) => {
    const result = validate(
        updateAdTypeStatusSchema,
        req.body
    );

    if (result.errors) {
        return res.status(400).json({
            success: false,
            message: "Validation failed.",
            errors: result.errors
        });
    }

    try {
        const data = await service.changeTypeStatus(
            req.params.id,
            result.value.is_active
        );

        return res.status(200).json({
            success: true,
            message: "Ad type status updated successfully.",
            data
        });
    } catch (error) {
        return handleError(res, error);
    }
};