import db from "../configs/database/db.js";
import * as model from "../models/adModel.js";

const createError = (message, statusCode) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const validateReference = async (table, id, label) => {
    const allowedTables = {
        ad_types: "ad_types",
        ad_objectives: "ad_objectives",
        ad_action_button_types: "ad_action_button_types",
    };

    const safeTable = allowedTables[table];

    if (!safeTable) {
        throw new Error("Invalid reference table.");
    }

    const [rows] = await db.execute(
        `SELECT id FROM ${safeTable}
         WHERE id = ? AND is_active = 1
         LIMIT 1`,
        [id]
    );

    if (rows.length === 0) {
        throw createError(`Selected ${label} is invalid or inactive.`, 400);
    }
};

const prepareFile = (file) => {
    if (!file) {
        throw createError("Please upload one image or video.", 400);
    }

    return {
        mediaType: file.mimetype.startsWith("image/")
            ? "image"
            : "video",
        fileUrl: `/uploads/ads/${file.filename}`,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
    };
};

export const createAd = async (userId, data, file) => {
    await validateReference("ad_types", data.ad_type_id, "ad type");
    await validateReference(
        "ad_objectives",
        data.objective_id,
        "advertising objective"
    );

    if (data.action_button_type_id != null) {
        await validateReference(
            "ad_action_button_types",
            data.action_button_type_id,
            "action button"
        );
    }

    const fileData = prepareFile(file);

    const adId = await model.createAd(userId, data, fileData);

    return model.getAdById(adId, userId);
};

export const getAd = async (adId, userId) => {
    const ad = await model.getAdById(adId, userId);

    if (!ad) {
        throw createError("Ad not found.", 404);
    }

    return ad;
};

export const updateAd = async (adId, userId, data, file) => {
    if (data.ad_type_id !== undefined) {
        await validateReference("ad_types", data.ad_type_id, "ad type");
    }

    if (data.objective_id !== undefined) {
        await validateReference(
            "ad_objectives",
            data.objective_id,
            "advertising objective"
        );
    }

    if (data.action_button_type_id != null) {
        await validateReference(
            "ad_action_button_types",
            data.action_button_type_id,
            "action button"
        );
    }

    const fileData = file ? prepareFile(file) : null;

    const result = await model.updateAd(
        adId,
        userId,
        data,
        fileData
    );

    if (result.notFound) {
        throw createError(
            "Draft ad not found. Only draft ads can be edited.",
            404
        );
    }

    return model.getAdById(adId, userId);
};