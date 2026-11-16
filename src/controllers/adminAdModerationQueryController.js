
import * as service from "../services/adminAdModerationQueryService.js";

export const getModerationQueueController = async (req, res, next) => {
  try {
    const data = await service.getModerationQueue(req.query);

    return res.status(200).json({
      success: true,
      message: "Ad moderation queue fetched successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getModerationDetailsController = async (req, res, next) => {
  try {
    const data = await service.getModerationDetails(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Ad moderation details fetched successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const downloadModerationDocumentController = async (
  req,
  res,
  next,
) => {
  try {
    const document = await service.getModerationDocument(
      req.params.historyId,
    );

    return res.download(
      document.filePath,
      document.downloadName,
      (error) => {
        if (error) {
          next(error);
        }
      },
    );
  } catch (error) {
    next(error);
  }
};
