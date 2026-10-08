import pool from "../configs/database/db.js";

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