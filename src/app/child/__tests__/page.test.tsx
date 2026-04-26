import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ChildPage from "../page";

// ─── Module mocks ────────────────────────────────────────────────────────────

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/app/ActivateNotificationsButton", () => ({
  ActivateNotificationsButton: () => null,
}));

// Build a minimal TaskStore stub so tests can override individual fields.
const defaultStore = {
  tasks: [],
  baseAllowance: 100,
  balance: 0,
  savingsGoal: "",
  childPinConfigured: false,
  settingsLoaded: true,
  weeklyTasks: [],
  bonusTasks: [],
  dayGroups: [],
  totalWeekly: 0,
  approvedWeeklyCount: 0,
  allWeeklyApproved: false,
  baseEarned: 0,
  maxBonus: 0,
  approvedBonusSum: 0,
  totalEarned: 0,
  childToggle: vi.fn(),
  setApproval: vi.fn(),
  approveAllPending: vi.fn(),
  setBaseAllowance: vi.fn(),
  setBalance: vi.fn(),
  setSavingsGoal: vi.fn(),
  setChildPin: vi.fn(),
  clearChildPin: vi.fn(),
  verifyChildPin: vi.fn(),
  addTask: vi.fn(),
  editTask: vi.fn(),
  deleteTask: vi.fn(),
  upsertStandardTask: vi.fn(),
  removeStandardTask: vi.fn(),
  seedInitialTasks: vi.fn(),
  resetAllData: vi.fn(),
};

// We override useTaskStore per test via a mutable reference.
let mockStore = { ...defaultStore };

vi.mock("@/lib/TaskContext", () => ({
  useTaskStore: () => mockStore,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderChildPage() {
  return render(<ChildPage />);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ChildPage – PIN-gate", () => {
  beforeEach(() => {
    // Reset store to defaults and clear sessionStorage before every test.
    mockStore = { ...defaultStore, verifyChildPin: vi.fn() };
    sessionStorage.clear();
  });

  it("viser lasteskjerm mens innstillinger lastes inn", () => {
    mockStore.settingsLoaded = false;

    renderChildPage();

    expect(screen.getByText("Laster…")).toBeInTheDocument();
  });

  it("viser PIN-skjerm fra ny nettleser når PIN er satt og ingen sesjonstoken finnes", () => {
    mockStore.childPinConfigured = true;
    // sessionStorage is empty (cleared in beforeEach – simulates new browser session)

    renderChildPage();

    expect(screen.getByRole("heading", { name: /Lås opp barnesiden/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/PIN-kode/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Lås opp/i })).toBeInTheDocument();
    // Main content should NOT be visible
    expect(screen.queryByText(/Almas ukelønn/i)).not.toBeInTheDocument();
  });

  it("viser innhold direkte når ingen PIN er konfigurert (ny nettleser uten PIN)", () => {
    mockStore.childPinConfigured = false;

    renderChildPage();

    // PIN screen should NOT appear
    expect(screen.queryByRole("heading", { name: /Lås opp barnesiden/i })).not.toBeInTheDocument();
    // Main content heading should be present
    expect(screen.getByRole("heading", { name: /Almas ukelønn/i })).toBeInTheDocument();
  });

  it("viser innhold når sesjonstoken allerede er lagret (returnerende besøk i samme nettleser)", () => {
    mockStore.childPinConfigured = true;
    // Simulate a session where the user has already unlocked
    sessionStorage.setItem("ukelonn-child-pin-unlocked", "yes");

    renderChildPage();

    expect(screen.queryByRole("heading", { name: /Lås opp barnesiden/i })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Almas ukelønn/i })).toBeInTheDocument();
  });

  it("viser feilmelding ved feil PIN", async () => {
    mockStore.childPinConfigured = true;
    mockStore.verifyChildPin = vi.fn().mockResolvedValue(false);

    renderChildPage();

    fireEvent.change(screen.getByLabelText(/PIN-kode/i), { target: { value: "9999" } });
    fireEvent.click(screen.getByRole("button", { name: /Lås opp/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Feil PIN.");
    });

    // Still on the PIN screen
    expect(screen.queryByRole("heading", { name: /Almas ukelønn/i })).not.toBeInTheDocument();
  });

  it("viser innhold etter riktig PIN er tastet inn", async () => {
    mockStore.childPinConfigured = true;
    mockStore.verifyChildPin = vi.fn().mockResolvedValue(true);

    renderChildPage();

    // Should start on the PIN screen
    expect(screen.getByRole("heading", { name: /Lås opp barnesiden/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/PIN-kode/i), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: /Lås opp/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Almas ukelønn/i })).toBeInTheDocument();
    });

    // PIN screen should be gone
    expect(screen.queryByRole("heading", { name: /Lås opp barnesiden/i })).not.toBeInTheDocument();

    // Persisted token should be set for the remainder of the session
    expect(sessionStorage.getItem("ukelonn-child-pin-unlocked")).toBe("yes");
  });

  it("viser valideringsfeil ved ugyldig PIN-format (ikke 4 siffer)", async () => {
    mockStore.childPinConfigured = true;
    mockStore.verifyChildPin = vi.fn();

    renderChildPage();

    fireEvent.change(screen.getByLabelText(/PIN-kode/i), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: /Lås opp/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Skriv inn 4 siffer.");
    });

    // verifyChildPin should never be called for invalid input
    expect(mockStore.verifyChildPin).not.toHaveBeenCalled();
  });
});
