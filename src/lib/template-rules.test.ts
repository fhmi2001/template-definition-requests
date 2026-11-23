// node --import tsx --test src/lib/*.test.ts — named placeholders (#GuestFirstName#) must not pass as plain text.
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateTemplate, findNamedPlaceholders, findTokens } from "./template-rules";

const evaluate = (text: string, variables: { type: "TEXT" | "NUMBER"; length: number }[] = []) =>
  evaluateTemplate({ text, signature: null, variables, customerType: null, hasPledge: false });
const textRule = (text: string, variables?: { type: "TEXT" | "NUMBER"; length: number }[]) =>
  evaluate(text, variables).rules.find((r) => r.id === "text")!;

test("finds named placeholders, in order, each once, in English and Arabic text", () => {
  assert.deepEqual(
    findNamedPlaceholders("Dear #GuestFirstName#,\nWelcome to #PropertyName# , call #Property Phone# or #PropertyName#"),
    ["#GuestFirstName#", "#PropertyName#", "#Property Phone#"],
  );
  assert.deepEqual(findNamedPlaceholders("عميلنا العزيز/ #GuestFirstName#\nللتواصل #PropertyPhone#"), ["#GuestFirstName#", "#PropertyPhone#"]);
  assert.deepEqual(findNamedPlaceholders("المبلغ #المبلغ# ريال"), ["#المبلغ#"]);
});

test("leaves #VarN#, hashtags, numbers and links alone", () => {
  for (const text of [
    "Your code is #Var1# valid for #Var2# minutes",
    "Your code is # var 1 #",
    "Join us #offer and #sale today",
    "Order #123 is ready, ticket #456",
    "Track it at https://example.com/page#section#top now",
    "رمز التحقق #Var1# صالح لمدة 2 دقائق",
    "50% off # limited",
  ]) {
    assert.deepEqual(findNamedPlaceholders(text), [], text);
  }
});

test("a named placeholder fails the text rule, so the request cannot be submitted", () => {
  const e = evaluate("Dear #GuestFirstName#, welcome to #PropertyName#");
  assert.equal(e.ok, false);
  const rule = e.rules.find((r) => r.id === "text")!;
  assert.equal(rule.status, "fail");
  assert.deepEqual(rule.details.at(-1), { k: "rules.text.named", p: { names: ["#GuestFirstName#", "#PropertyName#"] } });
  // the parser itself is unchanged: named placeholders are still not variables
  assert.equal(findTokens("Dear #GuestFirstName#").length, 0);
});

test("a named placeholder next to a real variable still fails", () => {
  assert.equal(textRule("Dear #Name#, your code is #Var1#", [{ type: "NUMBER", length: 4 }]).status, "fail");
});

test("a correct #VarN# template still passes the text rule", () => {
  assert.equal(textRule("Your REINVEST verification code #Var1# expires in 2 mins", [{ type: "TEXT", length: 4 }]).status, "pass");
  assert.equal(textRule("Welcome to our store. Thank you for your visit.").status, "pass");
});
