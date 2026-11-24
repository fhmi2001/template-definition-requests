import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedSenderTypes, isAdSenderName, senderNameLength, typeBlockReason } from "./sender-types";

test("a name ending with -AD is an advertising sender, any case", () => {
  assert.equal(isAdSenderName("Dfruit-AD"), true);
  assert.equal(isAdSenderName("dfruit-ad"), true);
  assert.equal(isAdSenderName("ADNOC"), false);
  assert.equal(isAdSenderName("Mabeet.sa"), false);
});

test("an -AD sender offers Advertisement only, even when the full name is over 8 characters", () => {
  assert.deepEqual(allowedSenderTypes("Dfruit-AD"), ["Advertisement"]);
  assert.deepEqual(allowedSenderTypes("ABCDEFGH-AD"), ["Advertisement"]);
  assert.equal(typeBlockReason("Service", "Dfruit-AD"), "adOnly");
  assert.equal(typeBlockReason("Advertisement", "Dfruit-AD"), null);
  assert.equal(senderNameLength("Dfruit-AD"), 6);
});

test("names without -AD keep the old rule: Advertisement only up to 8 characters", () => {
  assert.deepEqual(allowedSenderTypes("REINVEST"), ["Service", "Awareness", "Warning", "Advertisement"]);
  assert.deepEqual(allowedSenderTypes("Mabeet.sa"), ["Service", "Awareness", "Warning"]);
  assert.equal(typeBlockReason("Advertisement", "Mabeet.sa"), "adNameTooLong");
  assert.equal(senderNameLength("Mabeet.sa"), 9);
});
