import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import WorkspacePage from "./WorkspacePage";

describe("workspace preview pages", () => {
  it("filters customers and shows the selected account summary", () => {
    render(<WorkspacePage active="Customers" />);
    expect(screen.getByRole("heading", { name: "Customers" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Search customers" }), { target: { value: "Ramesh" } });
    expect(screen.getByText("Ramesh Kumar")).toBeInTheDocument();
    expect(screen.queryByText("Maa Grocery")).not.toBeInTheDocument();
    expect(screen.getByText("Outstanding balance")).toBeInTheDocument();
  });

  it("shows the append-only khata ledger preview", () => {
    render(<WorkspacePage active="Khata ledger" />);
    expect(screen.getByRole("heading", { name: "Khata ledger" })).toBeInTheDocument();
    expect(screen.getByText("Ledger history is append-only.")).toBeInTheDocument();
    expect(screen.getByText("Credit")).toBeInTheDocument();
    expect(screen.getByText("Payment")).toBeInTheDocument();
  });

  it("filters the product catalogue", () => {
    render(<WorkspacePage active="Inventory" />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search products" }), { target: { value: "Sugar" } });
    expect(screen.getByText("Sugar")).toBeInTheDocument();
    expect(screen.queryByText("Premium rice")).not.toBeInTheDocument();
  });

  it("keeps billing non-committing until backend setup is complete", () => {
    render(<WorkspacePage active="Sales & billing" />);
    expect(screen.getByText(/not active until a dedicated backend environment is configured/i)).toBeInTheDocument();
  });
});
