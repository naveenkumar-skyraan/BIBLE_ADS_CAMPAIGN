import * as service from "../services/adObjectiveService.js";

import {
    createAdObjectiveSchema,
    updateAdObjectiveSchema,
    updateAdObjectiveStatusSchema
} from "../validators/adObjectiveValidator.js";

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
    console.error("AD OBJECTIVE ERROR:", error);

    return res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode
            ? error.message
            : "Internal server error."
    });
};

export const createObjectiveController = async (req, res) => {
    const result = validate(createAdObjectiveSchema, req.body);

    if (result.errors) {
        return res.status(400).json({
            success: false,
            message: "Validation failed.",
            errors: result.errors
        });
    }

    try {
        const data = await service.createObjective(result.value);

        return res.status(201).json({
            success: true,
            message: "Ad objective created successfully.",
            data
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listObjectivesController = async (req, res) => {
    try {
        const includeInactive =
            req.query.include_inactive !== "false";

        const data = await service.listObjectives(includeInactive);

        return res.status(200).json({
            success: true,
            message: "Ad objectives fetched successfully.",
            data
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getObjectiveController = async (req, res) => {
    try {
        const data = await service.getObjective(req.params.id);

        return res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const updateObjectiveController = async (req, res) => {
    const result = validate(updateAdObjectiveSchema, req.body);

    if (result.errors) {
        return res.status(400).json({
            success: false,
            message: "Validation failed.",
            errors: result.errors
        });
    }

    try {
        const data = await service.editObjective(
            req.params.id,
            result.value
        );

        return res.status(200).json({
            success: true,
            message: "Ad objective updated successfully.",
            data
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const updateObjectiveStatusController = async (req, res) => {
    const result = validate(
        updateAdObjectiveStatusSchema,
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
        const data = await service.changeObjectiveStatus(
            req.params.id,
            result.value.is_active
        );

        return res.status(200).json({
            success: true,
            message: "Ad objective status updated successfully.",
            data
        });
    } catch (error) {
        return handleError(res, error);
    }
};