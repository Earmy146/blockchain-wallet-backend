/**
 * Chuẩn hóa format response API
 * File: backend/src/utils/response.js
 */

/**
 * Response thành công
 * @param {Object} res - Express response object
 * @param {*} data - Dữ liệu trả về
 * @param {String} message - Thông báo
 * @param {Number} statusCode - HTTP status code
 */
const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
};

/**
 * Response lỗi
 * @param {Object} res - Express response object
 * @param {String} message - Thông báo lỗi
 * @param {Number} statusCode - HTTP status code
 * @param {*} errors - Chi tiết lỗi (optional)
 */
const sendError = (res, message = 'Error', statusCode = 500, errors = null) => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };

  // Chỉ thêm errors nếu có
  if (errors) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

/**
 * Response cho validation errors
 * @param {Object} res - Express response object
 * @param {Array} errors - Mảng các lỗi validation
 */
const sendValidationError = (res, errors) => {
  return res.status(400).json({
    success: false,
    message: 'Dữ liệu không hợp lệ',
    errors: errors.map(err => ({
      field: err.path || err.param,
      message: err.msg || err.message
    })),
    timestamp: new Date().toISOString()
  });
};

/**
 * Response cho unauthorized
 */
const sendUnauthorized = (res, message = 'Bạn cần đăng nhập để thực hiện thao tác này') => {
  return sendError(res, message, 401);
};

/**
 * Response cho forbidden
 */
const sendForbidden = (res, message = 'Bạn không có quyền thực hiện thao tác này') => {
  return sendError(res, message, 403);
};

/**
 * Response cho not found
 */
const sendNotFound = (res, message = 'Không tìm thấy tài nguyên') => {
  return sendError(res, message, 404);
};

/**
 * Response cho pagination
 * @param {Object} res - Express response object
 * @param {Array} data - Dữ liệu
 * @param {Number} page - Trang hiện tại
 * @param {Number} limit - Số items mỗi trang
 * @param {Number} total - Tổng số items
 */
const sendPagination = (res, data, page, limit, total) => {
  return res.status(200).json({
    success: true,
    data,
    pagination: {
      currentPage: page,
      perPage: limit,
      total,
      totalPages: Math.ceil(total / limit)
    },
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  sendSuccess,
  sendError,
  sendValidationError,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendPagination
};