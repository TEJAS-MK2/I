import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import VoiceWorkspace from "./VoiceWorkspace";

describe("voice proposal review", () => {
  it("parses a review proposal but never enables persistence without a configured backend", () => {
    render(<VoiceWorkspace />);
    fireEvent.change(screen.getByLabelText(/Transcript \/ typed note/i), {
      target: { value: "Ramesh ₹150 udhar, 2 kg sugar" },
    });
    expect(screen.getByText("Ramesh")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save proposal for review/i })).toBeDisabled();
    expect(screen.getByText(/no transaction is saved/i)).toBeInTheDocument();
  });
});
