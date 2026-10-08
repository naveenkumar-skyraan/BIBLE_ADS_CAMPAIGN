import {
    createEnquiry,
    findMatchingActiveEnquiry,
    getEnquiryById
} from "../../src/models/enquiryModel.js";

export const submitEnquiry = async (enquiryData) => {
    const {
        email,
        business_name
    } = enquiryData;

    const phone = enquiryData.phone || null;

    const existingEnquiry = await findMatchingActiveEnquiry({
        email,
        business_name,
        phone
    });

    if (existingEnquiry) {
        const error = new Error(
            "An active enquiry already exists for the given email, business name, and phone number."
        );

        error.statusCode = 409;

        throw error;
    }

    const enquiryId = await createEnquiry({
        ...enquiryData,
        phone
    });

    const enquiry = await getEnquiryById(enquiryId);

    return enquiry;
};