import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import WorkspacePage from "./WorkspacePage";

describe("workspace preview pages", () => {
  it("filters customers and shows the selected account summary", () => {
    render(<WorkspacePage active="Customers" />);
    expect(screen.getByRole("heading", { name: "Customers" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Customers" }), { target: { value: "Ramesh" } });
    expect(screen.getAllByText("Ramesh Kumar").length).toBeGreaterThan(0);
    expect(screen.queryByText("Maa Grocery")).not.toBeInTheDocument();
    expect(screen.getByText("Outstanding balance")).toBeInTheDocument();
  });

  it("shows the append-only khata ledger preview", () => {
    render(<WorkspacePage active="Khata ledger" />);
    expect(screen.getByRole("heading", { name: "Khata ledger" })).toBeInTheDocument();
    expect(screen.getByText("Ledger history is append-only.")).toBeInTheDocument();
    expect(screen.getAllByText("Credit").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Reversal").length).toBeGreaterThan(0);
  });

  it("filters the product catalogue", () => {
    render(<WorkspacePage active="Inventory" />);
    fireEvent.change(screen.getByRole("textbox", { name: "Products" }), { target: { value: "Sugar" } });
    expect(screen.getByText("Sugar")).toBeInTheDocument();
    expect(screen.queryByText("Premium rice")).not.toBeInTheDocument();
  });

  it("keeps billing non-committing until backend setup is complete", () => {
    render(<WorkspacePage active="Sales & billing" />);
    expect(screen.getByText(/billing confirmation UI is still under development/i)).toBeInTheDocument();
  });
});
