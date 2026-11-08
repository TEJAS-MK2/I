import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("Boli-Khata foundation dashboard", () => {
  it("renders the business overview and sample-data notice", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /good morning, priya/i })).toBeInTheDocument();
    expect(screen.getAllByText(/sample data only/i).length).toBeGreaterThan(0);
  });

  it("provides the main workspace navigation", () => {
    render(<App />);
    expect(screen.getByRole("navigation", { name: /main navigation/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /inventory/i })).toBeInTheDocument();
  });

  it("opens the voice preview without claiming live speech recognition", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /try voice workspace/i }));
    expect(screen.getByText(/voice capture is planned for phase 2/i)).toBeInTheDocument();
  });

  it("updates the workspace breadcrumb when a section is selected", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /customers/i }));
    expect(screen.getAllByText("Customers").length).toBeGreaterThan(1);
  });
});
