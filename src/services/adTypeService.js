import * as model from "../models/adTypeModel.js";

const notFound = () => {
    const error = new Error("Ad type not found.");
    error.statusCode = 404;
    return error;
};

const handleDuplicateCode = (error) => {
    if (error.code === "ER_DUP_ENTRY") {
        const duplicateError = new Error(
            "An ad type with this code already exists."
        );
        duplicateError.statusCode = 409;
        return duplicateError;
    }

    return error;
};

export const createType = async (data) => {
    try {
        const id = await model.createAdType(data);
        return await model.getAdTypeById(id);
    } catch (error) {
        throw handleDuplicateCode(error);
    }
};

export const listTypes = async (includeInactive = true) => {
    return model.getAllAdTypes({ includeInactive });
};

export const getType = async (id) => {
    const type = await model.getAdTypeById(id);

    if (!type) {
        throw notFound();
    }

    return type;
};

export const editType = async (id, data) => {
    try {
        const affected = await model.updateAdType(id, data);

        if (!affected) {
            throw notFound();
        }

        return await model.getAdTypeById(id);
    } catch (error) {
        throw handleDuplicateCode(error);
    }
};

export const changeTypeStatus = async (id, isActive) => {
    const affected = await model.updateAdTypeStatus(id, isActive);

    if (!affected) {
        throw notFound();
    }

    return model.getAdTypeById(id);
};