import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "./AuthProvider";

describe("AuthProvider preview behavior", () => {
  it("keeps the sample workspace available when Supabase is not configured", () => {
    render(<AuthProvider><div>Preview workspace</div></AuthProvider>);
    expect(screen.getByText("Preview workspace")).toBeInTheDocument();
  });
});
