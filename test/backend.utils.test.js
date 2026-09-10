process.env.NODE_ENV = "test";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildPagination,
  buildUpdateSet,
  isUuid,
  normalizeSearch,
  parsePagination,
  validateBoolean,
  validateNonNegativeInteger,
  validateOptionalDate,
  validateOptionalString,
  validateRequiredString,
  validateUuid,
} = require("../src/utils/query.utils");

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

const assertAppError = (fn, message) => {
  assert.throws(fn, (error) => {
    assert.equal(error.statusCode, 400);
    assert.equal(error.message, message);
    return true;
  });
};

test("parsePagination applies defaults and calculates offset", () => {
  assert.deepEqual(parsePagination({}), { page: 1, limit: 10, offset: 0 });
  assert.deepEqual(parsePagination({ page: "3", limit: "25" }), {
    page: 3,
    limit: 25,
    offset: 50,
  });
});

test("parsePagination rejects invalid page and limit values", async (t) => {
  const cases = [
    [{ page: "1.5" }, "page must be an integer"],
    [{ page: "0" }, "Page must be greater than or equal to 1"],
    [{ limit: "0" }, "Limit must be between 1 and 100"],
    [{ limit: "101" }, "Limit must be between 1 and 100"],
  ];

  for (const [query, message] of cases) {
    await t.test(message, () => assertAppError(() => parsePagination(query), message));
  }
});

test("buildPagination handles empty and partial final pages", () => {
  assert.deepEqual(buildPagination(0, 1, 10), {
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 0,
  });
  assert.equal(buildPagination(21, 2, 10).totalPages, 3);
});

test("UUID helpers accept supported UUIDs and reject malformed IDs", () => {
  assert.equal(isUuid(VALID_UUID), true);
  assert.equal(isUuid("not-a-uuid"), false);
  assert.doesNotThrow(() => validateUuid(VALID_UUID, "songId"));
  assertAppError(
    () => validateUuid("not-a-uuid", "songId"),
    "songId must be a valid UUID"
  );
});

test("string validators trim input and enforce required/max-length rules", () => {
  assert.equal(validateRequiredString("  My playlist  ", "name"), "My playlist");
  assert.equal(validateOptionalString(undefined, "bio"), null);
  assert.equal(validateOptionalString("  hello  ", "bio"), "hello");
  assertAppError(() => validateRequiredString("   ", "name"), "name is required");
  assertAppError(
    () => validateRequiredString("abcd", "name", 3),
    "name must be at most 3 characters"
  );
});

test("boolean and non-negative integer validators reject coerced values", () => {
  assert.equal(validateBoolean(false, "is_public"), false);
  assert.equal(validateNonNegativeInteger(0, "position"), 0);
  assertAppError(
    () => validateBoolean("false", "is_public"),
    "is_public must be a boolean"
  );
  assertAppError(
    () => validateNonNegativeInteger(-1, "position"),
    "position must be a non-negative integer"
  );
});

test("date validation rejects impossible calendar dates", () => {
  assert.equal(validateOptionalDate("2026-09-10", "release_date"), "2026-09-10");
  assert.equal(validateOptionalDate("", "release_date"), null);
  assertAppError(
    () => validateOptionalDate("2026-02-30", "release_date"),
    "release_date must be a valid date"
  );
  assertAppError(
    () => validateOptionalDate("10/09/2026", "release_date"),
    "release_date must use YYYY-MM-DD format"
  );
});

test("buildUpdateSet ignores undefined fields and preserves null", () => {
  assert.deepEqual(
    buildUpdateSet({ name: "Updated", description: null, cover_url: undefined }, 2),
    {
      setClause: "name = $2, description = $3, updated_at = NOW()",
      values: ["Updated", null],
    }
  );
  assertAppError(
    () => buildUpdateSet({ name: undefined }),
    "At least one field is required to update"
  );
});

test("normalizeSearch trims values and produces a LIKE pattern", () => {
  assert.equal(normalizeSearch("  chill  "), "%chill%");
  assert.equal(normalizeSearch("   "), null);
  assert.equal(normalizeSearch(undefined), null);
});
