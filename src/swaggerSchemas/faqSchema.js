
const faqSchema = {
    FAQCategory: {
        type: "object",
        properties: {
            id: { type: "integer", example: 1 },
            name: { type: "string", example: "Wallet & Payments" },
            display_order: { type: "integer", example: 1 },
            question_count: { type: "integer", example: 5 }
        }
    },

    FAQQuestion: {
        type: "object",
        properties: {
            id: { type: "integer", example: 101 },
            category_id: { type: "integer", example: 1 },
            question: {
                type: "string",
                example: "How can I add money to my wallet?"
            },
            display_order: { type: "integer", example: 1 }
        }
    },

    FAQQuestionDetail: {
        type: "object",
        properties: {
            id: { type: "integer", example: 101 },
            category_id: { type: "integer", example: 1 },
            question: {
                type: "string",
                example: "How can I add money to my wallet?"
            },
            answer_content: {
                type: "string",
                description: "HTML-formatted FAQ answer",
                example: "<p>Open <strong>Ads Wallet</strong> and tap Add Money.</p>"
            },
            updated_at: {
                type: "string",
                format: "date-time"
            }
        }
    },

    FAQCategoriesResponse: {
        type: "object",
        properties: {
            success: { type: "boolean", example: true },
            message: {
                type: "string",
                example: "FAQ categories fetched successfully"
            },
            data: {
                type: "array",
                items: {
                    $ref: "#/components/schemas/FAQCategory"
                }
            }
        }
    },

    FAQQuestionsResponse: {
        type: "object",
        properties: {
            success: { type: "boolean", example: true },
            message: {
                type: "string",
                example: "FAQ questions fetched successfully"
            },
            data: {
                type: "array",
                items: {
                    $ref: "#/components/schemas/FAQQuestion"
                }
            }
        }
    },

    FAQQuestionDetailResponse: {
        type: "object",
        properties: {
            success: { type: "boolean", example: true },
            message: {
                type: "string",
                example: "FAQ details fetched successfully"
            },
            data: {
                $ref: "#/components/schemas/FAQQuestionDetail"
            }
        }
    }
};

export default faqSchema;
