const walletSchema = {
  WalletResponse: {
    type: "object",
    properties: {
      id: {
        type: "integer",
        example: 1,
      },
      user_id: {
        type: "integer",
        example: 10,
      },
      balance: {
        type: "number",
        example: 1500.0,
      },
      created_at: {
        type: "string",
        format: "date-time",
      },
      updated_at: {
        type: "string",
        format: "date-time",
      },
    },
  },

  WalletTopupResponse: {
    type: "object",
    properties: {
      id: { type: "integer", example: 25 },
      user_id: { type: "integer", example: 10 },
      wallet_id: { type: "integer", example: 1 },
      amount: { type: "number", example: 1000 },
      order_id: { type: "string" },
      cf_order_id: { type: "string", nullable: true },
      cf_payment_id: { type: "string", nullable: true },
      cf_reference_id: { type: "string", nullable: true },
      payment_status: {
        type: "string",
        enum: ["pending", "success", "failed"],
      },
      status_reason: {
        type: "string",
        nullable: true,
        example: "Payment could not be completed.",
      },
      payment_method: { type: "string", nullable: true },
      payment_reference: { type: "string", nullable: true },
      paid_at: {
        type: "string",
        format: "date-time",
        nullable: true,
      },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    },
  },

  GetWalletResponse: {
    type: "object",
    properties: {
      success: {
        type: "boolean",
        example: true,
      },
      data: {
        $ref: "#/components/schemas/WalletResponse",
      },
    },
  },

  CreateTopupRequest: {
    type: "object",
    required: ["amount"],
    properties: {
      amount: {
        type: "number",
        minimum: 1,
        example: 1000,
      },
    },
  },

  CreateTopupResponse: {
    type: "object",
    properties: {
      success: {
        type: "boolean",
        example: true,
      },
      message: {
        type: "string",
        example: "Top-up order created successfully",
      },
      data: {
        type: "object",
        properties: {
          topup_id: {
            type: "integer",
            example: 25,
          },
          order_id: {
            type: "string",
            example: "WALLET_10_1793350000000_a1b2c3d4",
          },
          cf_order_id: {
            type: "string",
            example: "order_123456",
          },
          payment_session_id: {
            type: "string",
            example: "session_example",
          },
          amount: {
            type: "number",
            example: 1000,
          },
          currency: {
            type: "string",
            example: "INR",
          },
          payment_status: {
            type: "string",
            enum: ["pending", "success", "failed"],
            example: "pending",
          },
        },
      },
    },
  },

  VerifyTopupRequest: {
    type: "object",
    required: ["order_id"],
    properties: {
      order_id: {
        type: "string",
        example: "WALLET_10_1793350000000_a1b2c3d4",
      },
    },
  },

  VerifyTopupResponse: {
    type: "object",
    properties: {
      success: {
        type: "boolean",
        example: true,
      },
      message: {
        type: "string",
        example: "Payment status verified successfully",
      },
      data: {
        type: "object",
        properties: {
          topup: {
            $ref: "#/components/schemas/WalletTopupResponse",
          },
          wallet: {
            $ref: "#/components/schemas/WalletResponse",
          },
          payment_status: {
            type: "string",
            enum: ["pending", "success", "failed"],
            example: "pending",
          },
          status_reason: {
            type: "string",
            nullable: true,
            example: "Your payment is being processed.",
          },
        },
      },
    },
  },

  GetWalletTransactionsRequest: {
    type: "object",
    example: {
      type: "all",
      date_filter: "last_month",
      cursor: null,
      limit: 10,
    },
    properties: {
      type: {
        type: "string",
        enum: ["all", "added", "ads_spend", "pending", "failed"],
        default: "all",
        example: "all",
        description: "Filter transactions by type.",
      },
      date_filter: {
        type: "string",
        enum: [
          "all",
          "today",
          "yesterday",
          "last_week",
          "last_month",
          "last_year",
        ],
        default: "all",
        example: "last_month",
        description: "Filter transactions by date range.",
      },
      cursor: {
        type: "object",
        nullable: true,
        description:
          "Pagination cursor returned in pagination.next_cursor from the previous response. Use null for the first page.",
        example: null,
        properties: {
          transaction_date: {
            type: "string",
            format: "date-time",
            example: "2026-10-18T10:00:00.000Z",
          },
          source_type: {
            type: "string",
            enum: ["wallet_transaction", "wallet_topup"],
            example: "wallet_transaction",
          },
          source_id: {
            type: "integer",
            example: 125,
          },
        },
        required: ["transaction_date", "source_type", "source_id"],
      },
      limit: {
        type: "integer",
        enum: [10],
        default: 10,
        example: 10,
        description: "Number of transactions per page. Currently fixed at 10.",
      },
    },
  },

  GetWalletTransactionsResponse: {
    type: "object",
    properties: {
      success: {
        type: "boolean",
        example: true,
      },
      data: {
        type: "object",
        properties: {
          transactions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                source_id: {
                  type: "integer",
                  example: 125,
                },
                source_type: {
                  type: "string",
                  enum: ["wallet_transaction", "wallet_topup"],
                  example: "wallet_transaction",
                },
                transaction_date: {
                  type: "string",
                  format: "date-time",
                },
                transaction_type: {
                  type: "string",
                  enum: ["top_up", "ad_spend"],
                  example: "top_up",
                },
                transaction_direction: {
                  type: "string",
                  enum: ["credit", "debit"],
                  example: "credit",
                },
                amount: {
                  type: "number",
                  example: 1000,
                },
                balance_before: {
                  type: "number",
                  nullable: true,
                  example: 500,
                },
                balance_after: {
                  type: "number",
                  nullable: true,
                  example: 1500,
                },
                business_id: {
                  type: "integer",
                  nullable: true,
                  example: 10,
                },
                campaign_id: {
                  type: "integer",
                  nullable: true,
                  example: 20,
                },
                reference_id: {
                  type: "integer",
                  nullable: true,
                  example: 125,
                },
                reference_type: {
                  type: "string",
                  nullable: true,
                  example: "wallet_topup",
                },
                description: {
                  type: "string",
                  nullable: true,
                  example: "Wallet top-up",
                },
                payment_status: {
                  type: "string",
                  enum: ["pending", "success", "failed"],
                  nullable: true,
                  example: "success",
                },
                status_reason: {
                  type: "string",
                  nullable: true,
                },
                order_id: {
                  type: "string",
                  nullable: true,
                  example: "WALLET_10_1793350000000_a1b2c3d4",
                },
                payment_method: {
                  type: "string",
                  nullable: true,
                  example: "upi",
                },
              },
            },
          },
          pagination: {
            type: "object",
            properties: {
              limit: {
                type: "integer",
                example: 10,
              },
              has_more: {
                type: "boolean",
                example: true,
              },
              next_cursor: {
                type: "object",
                nullable: true,
                properties: {
                  transaction_date: {
                    type: "string",
                    format: "date-time",
                    example: "2026-10-18T10:00:00.000Z",
                  },
                  source_type: {
                    type: "string",
                    enum: ["wallet_transaction", "wallet_topup"],
                    example: "wallet_transaction",
                  },
                  source_id: {
                    type: "integer",
                    example: 125,
                  },
                },
              },
            },
          },
        },
      },
    },
  },

  GetWalletTransactionRequest: {
    type: "object",
    required: ["transaction_id", "source_type"],
    properties: {
      transaction_id: {
        type: "integer",
        example: 125,
      },
      source_type: {
        type: "string",
        enum: ["wallet_transaction", "wallet_topup"],
        example: "wallet_transaction",
      },
    },
  },

  GetWalletTransactionResponse: {
    type: "object",
    properties: {
      success: {
        type: "boolean",
        example: true,
      },
      data: {
        type: "object",
        properties: {
          source_id: {
            type: "integer",
            example: 125,
          },
          source_type: {
            type: "string",
            enum: ["wallet_transaction", "wallet_topup"],
          },
          transaction_date: {
            type: "string",
            format: "date-time",
          },
          transaction_type: {
            type: "string",
            enum: ["top_up", "ad_spend"],
          },
          transaction_direction: {
            type: "string",
            enum: ["credit", "debit"],
          },
          amount: {
            type: "number",
            example: 1000,
          },
          balance_before: {
            type: "number",
            nullable: true,
          },
          balance_after: {
            type: "number",
            nullable: true,
          },
          business_id: {
            type: "integer",
            nullable: true,
          },
          campaign_id: {
            type: "integer",
            nullable: true,
          },
          reference_id: {
            type: "integer",
            nullable: true,
          },
          reference_type: {
            type: "string",
            nullable: true,
          },
          description: {
            type: "string",
            nullable: true,
          },
          payment_status: {
            type: "string",
            enum: ["pending", "success", "failed"],
            nullable: true,
          },
          status_reason: {
            type: "string",
            nullable: true,
          },
          order_id: {
            type: "string",
            nullable: true,
          },
          payment_method: {
            type: "string",
            nullable: true,
          },
          cf_order_id: {
            type: "string",
            nullable: true,
          },
          cf_payment_id: {
            type: "string",
            nullable: true,
          },
          cf_reference_id: {
            type: "string",
            nullable: true,
          },
          payment_reference: {
            type: "string",
            nullable: true,
          },
          paid_at: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
        },
      },
    },
  },
};
export default walletSchema;
