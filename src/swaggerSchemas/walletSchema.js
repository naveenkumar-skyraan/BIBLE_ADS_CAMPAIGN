const walletSchema = {
    WalletResponse: {
        type: "object",
        properties: {
            id: {
                type: "integer",
                example: 1
            },
            user_id: {
                type: "integer",
                example: 25
            },
            balance: {
                type: "string",
                example: "5240.00"
            },
            created_at: {
                type: "string",
                format: "date-time"
            },
            updated_at: {
                type: "string",
                format: "date-time"
            }
        }
    },

    GetWalletResponse: {
        type: "object",
        properties: {
            success: {
                type: "boolean",
                example: true
            },
            message: {
                type: "string",
                example: "Wallet fetched successfully"
            },
            data: {
                $ref: "#/components/schemas/WalletResponse"
            }
        }
    },

    CreateTopupRequest: {
        type: "object",
        required: [
            "amount"
        ],
        properties: {
            amount: {
                type: "number",
                format: "double",
                example: 1000
            }
        }
    },

    VerifyTopupRequest: {
        type: "object",
        required: [
            "order_id"
        ],
        properties: {
            order_id: {
                type: "string",
                example: "WALLET_25_1791234567890_a1b2c3d4e5"
            }
        }
    },

    AllocateFundRequest: {
        type: "object",
        required: [
            "business_id",
            "ad_id",
            "amount"
        ],
        properties: {
            business_id: {
                type: "integer",
                example: 5
            },
            ad_id: {
                type: "integer",
                example: 25
            },
            amount: {
                type: "number",
                format: "double",
                example: 1500
            }
        }
    },

    SpendFundRequest: {
        type: "object",
        required: [
            "amount"
        ],
        properties: {
            amount: {
                type: "number",
                format: "double",
                example: 200
            }
        }
    },

    AdFundResponse: {
        type: "object",
        properties: {
            id: {
                type: "integer",
                example: 1
            },
            user_id: {
                type: "integer",
                example: 25
            },
            business_id: {
                type: "integer",
                example: 5
            },
            ad_id: {
                type: "integer",
                example: 25
            },
            allocated_amount: {
                type: "string",
                example: "1500.00"
            },
            spent_amount: {
                type: "string",
                example: "200.00"
            },
            remaining_amount: {
                type: "string",
                example: "1300.00"
            },
            status: {
                type: "string",
                enum: [
                    "active",
                    "completed",
                    "refund_pending",
                    "refunded"
                ],
                example: "active"
            },
            refund_amount: {
                type: "string",
                example: "0.00"
            },
            created_at: {
                type: "string",
                format: "date-time"
            },
            updated_at: {
                type: "string",
                format: "date-time"
            }
        }
    }
};

export default walletSchema;