import { describe, expect, it } from "vitest";
import { handleTextFieldKey } from "./text-field.js";

describe("handleTextFieldKey", () => {
  it("commits on return", () => {
    expect(handleTextFieldKey("sometext", "return")).toEqual({
      action: "commit",
    });
  });

  it("cancels on escape", () => {
    expect(handleTextFieldKey("sometext", "escape")).toEqual({
      action: "cancel",
    });
  });

  it("removes the last character on backspace", () => {
    expect(handleTextFieldKey("sometext", "backspace")).toEqual({
      action: "update",
      value: "sometex",
    });
  });

  it("appends a single printable character", () => {
    expect(handleTextFieldKey("sometex", "t")).toEqual({
      action: "update",
      value: "sometext",
    });
  });

  it("refuses to append past maxLength", () => {
    expect(handleTextFieldKey("sometext", "1", 8)).toEqual({
      action: "update",
      value: "sometext",
    });
  });
});
