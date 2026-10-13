import assert from "node:assert/strict";
import { test } from "node:test";
import { AxiosError, AxiosHeaders } from "axios";
import { apiErrorMessage } from "../src/api.ts";

test("apiErrorMessage extracts sanitized backend detail from AxiosError", () => {
  const axiosError = new AxiosError(
    "Request failed with status code 422",
    "ERR_BAD_REQUEST",
    undefined,
    undefined,
    {
      data: { detail: "The selected clips do not fit the target duration." },
      status: 422,
      statusText: "Unprocessable Entity",
      headers: {},
      config: { headers: new AxiosHeaders() },
    },
  );

  const message = apiErrorMessage(axiosError, "Default fallback");
  assert.equal(message, "The selected clips do not fit the target duration.");
});

test("apiErrorMessage returns connection message when AxiosError has no response", () => {
  const networkError = new AxiosError(
    "Network Error",
    "ERR_NETWORK",
    undefined,
    undefined,
    undefined,
  );

  const message = apiErrorMessage(networkError, "Default fallback");
  assert.equal(message, "Unable to connect to the server. Check your connection and try again.");
});

test("apiErrorMessage falls back to error.message for non-Axios Error instances", () => {
  const plainError = new Error("Something custom went wrong");
  const message = apiErrorMessage(plainError, "Default fallback");
  assert.equal(message, "Something custom went wrong");
});

test("apiErrorMessage returns fallback for unknown error types or empty details", () => {
  assert.equal(apiErrorMessage(null, "Fallback message"), "Fallback message");
  assert.equal(apiErrorMessage({}, "Fallback message"), "Fallback message");
});
