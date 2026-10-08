import * as model from "../models/adObjectiveModel.js";

const notFound = () => {
    const error = new Error("Ad objective not found.");
    error.statusCode = 404;
    return error;
};

export const createObjective = async (data) => {
    const id = await model.createAdObjective(data);
    return model.getAdObjectiveById(id);
};

export const listObjectives = async (includeInactive = true) => {
    return model.getAllAdObjectives({ includeInactive });
};

export const getObjective = async (id) => {
    const objective = await model.getAdObjectiveById(id);

    if (!objective) {
        throw notFound();
    }

    return objective;
};

export const editObjective = async (id, data) => {
    const affected = await model.updateAdObjective(id, data);

    if (!affected) {
        throw notFound();
    }

    return model.getAdObjectiveById(id);
};

export const changeObjectiveStatus = async (id, isActive) => {
    const affected = await model.updateAdObjectiveStatus(
        id,
        isActive
    );

    if (!affected) {
        throw notFound();
    }

    return model.getAdObjectiveById(id);
};