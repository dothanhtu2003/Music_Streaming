const AppError = require("./appError");

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const parsePaginationValue = (value, defaultValue, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue)) {
    throw new AppError(`${fieldName} must be an integer`, 400);
  }

  return parsedValue;
};

const parsePagination = (query) => {
  const page = parsePaginationValue(query.page, 1, "page");
  const limit = parsePaginationValue(query.limit, 10, "limit");

  if (page < 1) {
    throw new AppError("Page must be greater than or equal to 1", 400);
  }

  if (limit < 1 || limit > 100) {
    throw new AppError("Limit must be between 1 and 100", 400);
  }

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
};

const buildPagination = (totalItems, page, limit) => {
  return {
    page,
    limit,
    totalItems,
    totalPages: Math.ceil(totalItems / limit),
  };
};

const getTotalCount = (rows) => {
  if (rows.length === 0) {
    return 0;
  }

  return Number(rows[0].total_count);
};

const normalizeSearch = (value) => {
  const search = String(value || "").trim();
  return search.length > 0 ? `%${search}%` : null;
};

const isUuid = (value) => {
  return uuidRegex.test(String(value || ""));
};

const validateUuid = (value, fieldName = "id") => {
  if (!isUuid(value)) {
    throw new AppError(`${fieldName} must be a valid UUID`, 400);
  }
};

const normalizeString = (value) => {
  if (value === null || value === undefined) {
    return value;
  }

  return String(value).trim();
};

const validateRequiredString = (value, fieldName, maxLength = 255) => {
  const normalizedValue = normalizeString(value);

  if (!normalizedValue) {
    throw new AppError(`${fieldName} is required`, 400);
  }

  if (normalizedValue.length > maxLength) {
    throw new AppError(`${fieldName} must be at most ${maxLength} characters`, 400);
  }

  return normalizedValue;
};

const validateOptionalString = (value, fieldName, maxLength = 1000) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const normalizedValue = normalizeString(value);

  if (normalizedValue.length > maxLength) {
    throw new AppError(`${fieldName} must be at most ${maxLength} characters`, 400);
  }

  return normalizedValue;
};

const validateOptionalUuid = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  validateUuid(value, fieldName);
  return value;
};

const validateBoolean = (value, fieldName) => {
  if (typeof value !== "boolean") {
    throw new AppError(`${fieldName} must be a boolean`, 400);
  }

  return value;
};

const validateOptionalBoolean = (value, fieldName) => {
  if (value === undefined) {
    return undefined;
  }

  return validateBoolean(value, fieldName);
};

const validateNonNegativeInteger = (value, fieldName) => {
  if (!Number.isInteger(value) || value < 0) {
    throw new AppError(`${fieldName} must be a non-negative integer`, 400);
  }

  return value;
};

const validateOptionalDate = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const normalizedValue = normalizeString(value);
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (!dateRegex.test(normalizedValue)) {
    throw new AppError(`${fieldName} must use YYYY-MM-DD format`, 400);
  }

  const date = new Date(`${normalizedValue}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== normalizedValue
  ) {
    throw new AppError(`${fieldName} must be a valid date`, 400);
  }

  return normalizedValue;
};

const buildUpdateSet = (fields, startIndex = 2) => {
  const entries = Object.entries(fields).filter(([, value]) => {
    return value !== undefined;
  });

  if (entries.length === 0) {
    throw new AppError("At least one field is required to update", 400);
  }

  const values = entries.map(([, value]) => value);
  const clauses = entries.map(([field], index) => {
    return `${field} = $${startIndex + index}`;
  });

  clauses.push("updated_at = NOW()");

  return {
    setClause: clauses.join(", "),
    values,
  };
};

module.exports = {
  parsePagination,
  buildPagination,
  getTotalCount,
  normalizeSearch,
  isUuid,
  validateUuid,
  validateRequiredString,
  validateOptionalString,
  validateOptionalUuid,
  validateBoolean,
  validateOptionalBoolean,
  validateNonNegativeInteger,
  validateOptionalDate,
  buildUpdateSet,
};
