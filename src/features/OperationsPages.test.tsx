import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CommunicationsPage, LogisticsPage } from "./OperationsPages";

describe("operations workspaces", () => {
  it("shows a safe preview for deliveries when no backend is configured", () => {
    render(<LogisticsPage />);
    expect(screen.getByRole("heading", { name: "Deliveries" })).toBeInTheDocument();
    expect(screen.getByText(/preview mode/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create delivery job/i })).toBeDisabled();
  });

  it("explains that communications are queued only and requires backend setup", () => {
    render(<CommunicationsPage />);
    expect(screen.getByRole("heading", { name: "Communications" })).toBeInTheDocument();
    expect(screen.getByText(/consent comes first/i)).toBeInTheDocument();
    expect(screen.getByText(/no whatsapp, sms or email is sent/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /queue notification/i })).toBeDisabled();
  });
});
