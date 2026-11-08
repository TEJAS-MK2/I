import { fireEvent, render, screen, within } from "@testing-library/react";
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
    expect(screen.getAllByRole("navigation", { name: /main navigation/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /inventory/i }).length).toBeGreaterThan(0);
  });

  it("opens the voice preview without claiming live speech recognition", () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: /try voice workspace/i })[0]);
    expect(screen.getByRole("heading", { name: /say it your way\. review before saving/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/recognition language/i)).toBeInTheDocument();
  });

  it("updates the workspace breadcrumb when a section is selected", () => {
    render(<App />);
    const navigation = screen.getAllByRole("navigation", { name: /main navigation/i })[0];
    fireEvent.click(within(navigation).getByRole("button", { name: /customers/i }));
    expect(screen.getAllByText("Customers").length).toBeGreaterThan(1);
  });
});
