import pool from "../configs/database/db.js";

const buildAdminEnquiryConditions = ({ search = "", status = null } = {}) => {
    const conditions = [];
    const values = [];

    const searchTerm = String(search || "").trim();

    if (searchTerm) {
        conditions.push(`(
            name LIKE ?
            OR email LIKE ?
            OR phone LIKE ?
            OR business_name LIKE ?
            OR business_type LIKE ?
            OR location LIKE ?
        )`);

        const keyword = `%${searchTerm}%`;

        values.push(
            keyword,
            keyword,
            keyword,
            keyword,
            keyword,
            keyword
        );
    }

    const statusFilter = String(status || "").trim();

    if (statusFilter) {
        conditions.push("status = ?");
        values.push(statusFilter);
    }

    return {
        whereClause: conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "",
        values
    };
};

export const createEnquiry = async ({
    name,
    phone,
    email,
    location,
    business_name,
    business_type,
    enquiry,
    is_logged_user
}) => {
    const [result] = await pool.execute(
        `
        INSERT INTO enquiries
        (
            name,
            phone,
            email,
            location,
            business_name,
            business_type,
            enquiry,
            is_logged_user
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
            name,
            phone,
            email,
            location,
            business_name,
            business_type,
            enquiry || null,
            is_logged_user
        ]
    );

    return result.insertId;
};

export const findMatchingActiveEnquiry = async ({
    email,
    business_name,
    phone
}) => {
    const [rows] = await pool.execute(
        `
        SELECT
            id,
            status
        FROM enquiries
        WHERE email = ?
          AND business_name = ?
          AND phone <=> ?
          AND status IN ('pending', 'contacted')
        ORDER BY id DESC
        LIMIT 1
        `,
        [
            email,
            business_name,
            phone
        ]
    );

    return rows[0] || null;
};

export const getEnquiryById = async (id) => {
    const [rows] = await pool.execute(
        `
        SELECT
            id,
            name,
            phone,
            email,
            location,
            business_name,
            business_type,
            enquiry,
            is_logged_user,
            status,
            created_at,
            updated_at
        FROM enquiries
        WHERE id = ?
        LIMIT 1
        `,
        [id]
    );

    return rows[0] || null;
};

export const getAllEnquiries = async () => {
    const [rows] = await pool.execute(
        `
        SELECT
            id,
            name,
            phone,
            email,
            location,
            business_name,
            business_type,
            enquiry,
            is_logged_user,
            status,
            created_at,
            updated_at
        FROM enquiries
        ORDER BY created_at DESC
        `
    );

    return rows;
};

export const getAdminEnquiries = async ({
    search = "",
    status = null,
    limit = 10,
    offset = 0
}) => {
    const { whereClause, values } = buildAdminEnquiryConditions({
        search,
        status
    });

    const [rows] = await pool.execute(
        `
        SELECT
            id,
            name,
            phone,
            email,
            location,
            business_name,
            business_type,
            enquiry,
            is_logged_user,
            status,
            created_at,
            updated_at
        FROM enquiries
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
        `,
        [...values, Number(limit), Number(offset)]
    );

    return rows;
};

export const getAdminEnquiriesCount = async ({
    search = "",
    status = null
}) => {
    const { whereClause, values } = buildAdminEnquiryConditions({
        search,
        status
    });

    const [rows] = await pool.execute(
        `
        SELECT COUNT(*) AS total
        FROM enquiries
        ${whereClause}
        `,
        values
    );

    return Number(rows[0]?.total || 0);
};

export const updateEnquiryStatus = async (id, status) => {
    const [result] = await pool.execute(
        `
        UPDATE enquiries
        SET status = ?
        WHERE id = ?
        `,
        [status, id]
    );

    return result.affectedRows;
};