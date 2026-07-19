export const sendSuccess = (res, data, statusCode = 200) => {
    return res.status(statusCode).json({ success: true, data });
};
export const sendError = (res, message, statusCode = 500) => {
    return res.status(statusCode).json({ success: false, message });
};
export const sendPaginated = (res, data, total, page, limit) => {
    return res.status(200).json({
        success: true,
        data,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            hasMore: page * limit < total,
        },
    });
};
