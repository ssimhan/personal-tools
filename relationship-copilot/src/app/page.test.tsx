import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "./page";

describe("home page", () => {
  it("introduces the product and offers sign in", () => {
    render(<HomePage />);

    expect(screen.getByText("Relationship Copilot")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Remember people, clearly." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
