import * as service from "../services/adService.js";
import {
    createAdSchema,
    updateAdSchema,
} from "../validators/adValidator.js";

import fs from "node:fs/promises";

const validate = (schema, body) => {
    const { error, value } = schema.validate(body, {
        abortEarly: false,
        stripUnknown: false,
        convert: true,
    });

    if (!error) {
        return { value };
    }

    const errors = {};

    for (const detail of error.details) {
        const field = detail.path.join(".");

        if (!errors[field]) {
            errors[field] = detail.message;
        }
    }

    return { errors };
};

const removeUploadedFile = async (file) => {
    if (!file?.path) return;

    try {
        await fs.unlink(file.path);
    } catch (error) {
        console.error("UPLOAD CLEANUP ERROR:", error.message);
    }
};

const handleError = (res, error) => {
    console.error("AD ERROR:", error);

    return res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode
            ? error.message
            : "Internal server error.",
    });
};

export const createAdController = async (req, res) => {
    const result = validate(createAdSchema, req.body);

    if (result.errors) {
        await removeUploadedFile(req.file);

        return res.status(400).json({
            success: false,
            message: "Validation failed.",
            errors: result.errors,
        });
    }

    try {
        const data = await service.createAd(
            req.user.id,
            result.value,
            req.file
        );

        return res.status(201).json({
            success: true,
            message: "Draft ad created successfully.",
            data,
        });
    } catch (error) {
        await removeUploadedFile(req.file);
        return handleError(res, error);
    }
};

export const getAdController = async (req, res) => {
    try {
        const data = await service.getAd(
            req.params.id,
            req.user.id
        );

        return res.status(200).json({
            success: true,
            message: "Ad fetched successfully.",
            data,
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const updateAdController = async (req, res) => {
    const result = validate(updateAdSchema, req.body);

    if (result.errors) {
        await removeUploadedFile(req.file);

        return res.status(400).json({
            success: false,
            message: "Validation failed.",
            errors: result.errors,
        });
    }

    try {
        const data = await service.updateAd(
            req.params.id,
            req.user.id,
            result.value,
            req.file
        );

        return res.status(200).json({
            success: true,
            message: "Draft ad updated successfully.",
            data,
        });
    } catch (error) {
        await removeUploadedFile(req.file);
        return handleError(res, error);
    }
};