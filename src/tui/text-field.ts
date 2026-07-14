export type TextFieldEditResult =
  | { action: "update"; value: string }
  | { action: "commit" }
  | { action: "cancel" };

export function handleTextFieldKey(
  current: string,
  key: string,
  maxLength?: number,
): TextFieldEditResult {
  if (key === "return") {
    return { action: "commit" };
  }
  if (key === "escape") {
    return { action: "cancel" };
  }
  if (key === "backspace") {
    return { action: "update", value: current.slice(0, -1) };
  }
  if (
    key.length === 1 &&
    (maxLength === undefined || current.length < maxLength)
  ) {
    return { action: "update", value: current + key };
  }
  return { action: "update", value: current };
}
