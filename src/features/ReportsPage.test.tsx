import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReportsPage } from "./OperationsPages";

describe("business reports workspace", () => {
  it("shows India-time reporting preview without a configured backend", () => {
    render(<ReportsPage />);
    expect(screen.getByRole("heading", { name: "Reports" })).toBeInTheDocument();
    expect(screen.getByText(/Asia\/Kolkata/i)).toBeInTheDocument();
    expect(screen.getByText(/preview mode/i)).toBeInTheDocument();
  });
});
