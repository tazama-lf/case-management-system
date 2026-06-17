import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import AlertsDetailModal from "../AlertsDetailModal";
import triageService from "../../services/triageservice";
import userService from "../../../cases/services/userService";
import { taskService } from "../../../cases/services/taskService";
import { canActOnCase, useCase } from "../../../cases/hooks/useCase";
import { useSystemConfig } from "../../../../shared/hooks/useSystemConfig";
import { caseService } from "../../../cases/services/caseService";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../services/triageservice", () => ({
  default: {
    getAlertById: vi.fn(),
    getAlertActionHistory: vi.fn(),
    updateAlert: vi.fn(),
  },
}));

vi.mock("../../../cases/services/userService", () => ({
  default: {
    getUserDetailsById: vi.fn(),
    formatUserName: vi.fn(),
  },
}));

vi.mock("../../../cases/services/taskService", () => ({
  taskService: {
    getTasksByCaseId: vi.fn(),
  },
}));

vi.mock("../../../cases/hooks/useCase", () => ({
  useCase: vi.fn(),
  canActOnCase: vi.fn(),
}));

vi.mock("../../../../shared/hooks/useSystemConfig", () => ({
  useSystemConfig: vi.fn(),
}));

vi.mock("../../../cases/services/caseService", () => ({
  caseService: {
    checkCaseAccess: vi.fn(),
  },
}));

vi.mock("@/shared/utils/dateUtils", () => ({
  formatDate: vi.fn(() => "Jan 1, 05:00 AM"),
}));

type RenderOptions = Partial<React.ComponentProps<typeof AlertsDetailModal>>;

const mockOnClose = vi.fn();
const mockOnAlertUpdated = vi.fn();
const mockOnManualTriage = vi.fn();
const mockOnNavigateToCase = vi.fn();

const baseAlert = {
  alert_id: 123,
  tenant_id: "DEFAULT",
  priority: "URGENT",
  alert_type: "ALRT",
  source: "REST API",
  txtp: "pacs.008",
  message: "Suspicious activity detected",
  alert_data: {},
  transaction: {
    id: "tx-456",
    amount: 1000,
  },
  network_map: {},
  confidence_per: 85,
  created_at: "2024-01-01T05:00:00.000Z",
  case_id: null,
  prediction_outcome: null,
  alerted_typologies: [],
};

const actionHistoryItem = {
  audit_log_id: 1,
  user_id: "user-1",
  operation: "ALERT_VIEWED",
  entity_name: "AlertService",
  action_performed: "Alert opened by user user-1",
  outcome: "SUCCESS",
  performed_at: "2024-01-01T05:00:00.000Z",
};

const renderModal = (props: RenderOptions = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AlertsDetailModal
          alertId={123}
          isOpen={true}
          onClose={mockOnClose}
          onAlertUpdated={mockOnAlertUpdated}
          {...props}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const mockGetAlertById = triageService.getAlertById as Mock;
const mockGetAlertActionHistory = triageService.getAlertActionHistory as Mock;
const mockGetUserDetailsById = userService.getUserDetailsById as Mock;
const mockFormatUserName = userService.formatUserName as Mock;
const mockGetTasksByCaseId = taskService.getTasksByCaseId as Mock;
const mockUseCase = useCase as Mock;
const mockCanActOnCase = canActOnCase as Mock;
const mockUseSystemConfig = useSystemConfig as Mock;
const mockCheckCaseAccess = caseService.checkCaseAccess as Mock;

describe("AlertsDetailModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetAlertById.mockResolvedValue({ ...baseAlert });
    mockGetAlertActionHistory.mockResolvedValue([]);
    mockGetUserDetailsById.mockResolvedValue({
      user_id: "user-1",
      first_name: "Jane",
      last_name: "Doe",
    });
    mockFormatUserName.mockReturnValue("Jane Doe");
    mockGetTasksByCaseId.mockResolvedValue([]);
    mockUseCase.mockReturnValue({ data: null, isLoading: false });
    mockCanActOnCase.mockReturnValue(true);
    mockUseSystemConfig.mockReturnValue({
      isManualMode: false,
      isDisabledMode: false,
      isAIMode: false,
    });
    mockCheckCaseAccess.mockResolvedValue(true);
  });

  it("does not render when closed", () => {
    renderModal({ isOpen: false });

    expect(screen.queryByText("Alert Details")).not.toBeInTheDocument();
    expect(mockGetAlertById).not.toHaveBeenCalled();
  });

  it("does not fetch details when alertId is null", () => {
    renderModal({ alertId: null });

    expect(screen.queryByText("Alert Details")).not.toBeInTheDocument();
    expect(mockGetAlertById).not.toHaveBeenCalled();
  });

  it("shows loading state while fetching alert details", () => {
    renderModal();

    expect(screen.getByText("Loading alert details...")).toBeInTheDocument();
  });

  it("loads and displays alert summary", async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByText("Alert Details")).toBeInTheDocument();
    });

    expect(screen.getByText("URGENT")).toBeInTheDocument();
    expect(screen.getAllByText("123").length).toBeGreaterThan(0);
    expect(screen.getByText(/REST API/i)).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
    expect(screen.getByText("Jan 1, 05:00 AM")).toBeInTheDocument();
  });

  it("shows an error state when alert details fail to load", async () => {
    mockGetAlertById.mockRejectedValue(new Error("Failed to load alert"));

    renderModal();

    await waitFor(() => {
      expect(screen.getByText("Error Loading Alert")).toBeInTheDocument();
    });

    expect(screen.getByText("Failed to load alert")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByText("Alert Details")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /close/i }));

    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockOnAlertUpdated).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when retry error close button is clicked", async () => {
    mockGetAlertById.mockRejectedValue(new Error("Failed to load alert"));

    renderModal();

    await waitFor(() => {
      expect(screen.getByText("Error Loading Alert")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /close/i }));

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("displays transaction data by default", async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByText("Alert Details")).toBeInTheDocument();
    });

    expect(screen.getByText(/tx-456/i)).toBeInTheDocument();
    expect(screen.getByText(/1000/i)).toBeInTheDocument();
  });

  it("switches to alert data tab", async () => {
    mockGetAlertById.mockResolvedValue({
      ...baseAlert,
      alert_data: {
        status: "ALRT",
        reason: "Suspicious activity detected",
      },
    });

    renderModal();

    await waitFor(() => {
      expect(screen.getByText("Alert Details")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /alert data/i }));

    expect(screen.getByText(/reason/i)).toBeInTheDocument();
    expect(screen.getByText(/Suspicious activity detected/i)).toBeInTheDocument();
  });

  it("shows no transaction data when transaction is missing", async () => {
    mockGetAlertById.mockResolvedValue({
      ...baseAlert,
      transaction: null,
    });

    renderModal();

    await waitFor(() => {
      expect(screen.getByText("No transaction data")).toBeInTheDocument();
    });
  });

  it("shows no alert data when alert_data is missing", async () => {
    mockGetAlertById.mockResolvedValue({
      ...baseAlert,
      alert_data: null,
    });

    renderModal();

    await waitFor(() => {
      expect(screen.getByText("Alert Details")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /alert data/i }));

    expect(screen.getByText("No alert data")).toBeInTheDocument();
  });

  it("shows no action history message when history is empty", async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByText("No action history available")).toBeInTheDocument();
    });
  });

  it("renders action history and replaces user id with formatted name", async () => {
    mockGetAlertActionHistory.mockResolvedValue([actionHistoryItem]);

    renderModal();

    await waitFor(() => {
      expect(screen.getByText(/Alert opened by user Jane Doe/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/User ID: user-1/i)).toBeInTheDocument();
  });

  it("falls back to no action history when history request fails", async () => {
    mockGetAlertActionHistory.mockRejectedValue(new Error("History failed"));

    renderModal();

    await waitFor(() => {
      expect(screen.getByText("No action history available")).toBeInTheDocument();
    });
  });

  it("shows no typologies message when backend returns no alerted_typologies", async () => {
    mockGetAlertById.mockResolvedValue({
      ...baseAlert,
      alerted_typologies: [],
    });

    renderModal();

    await waitFor(() => {
      expect(screen.getByText("Triggered Typologies")).toBeInTheDocument();
      expect(screen.getByText("No typologies triggered")).toBeInTheDocument();
    });
  });

  it("displays triggered typologies from backend alerted_typologies", async () => {
    mockGetAlertById.mockResolvedValue({
      ...baseAlert,
      alerted_typologies: [
        {
          id: "typology-1",
          cfg: "Money Laundering",
          result: 95,
          alertThreshold: 50,
          interdictionThreshold: 80,
          ruleResults: [
            {
              id: "075@1.0.0",
              cfg: "1.0.0",
              wght: 100,
              prcgTm: 32943014,
              tenantId: "DEFAULT",
              subRuleRef: ".02",
              indpdntVarbl: 1,
            },
          ],
        },
      ],
    });

    renderModal();

    await waitFor(() => {
      expect(screen.getByText("Money Laundering")).toBeInTheDocument();
      expect(screen.getByText(/Alert Threshold:\s*50/i)).toBeInTheDocument();
      expect(screen.getByText(/Interdiction Threshold:\s*80/i)).toBeInTheDocument();
      expect(screen.getByText(/Typology Score:\s*95\.00/i)).toBeInTheDocument();
      expect(screen.getByText("075@1.0.0")).toBeInTheDocument();
      expect(screen.getByText(/Weight:\s*100\.00/i)).toBeInTheDocument();
      expect(screen.getByText(/Sub-ref:\s*\.02/i)).toBeInTheDocument();
      expect(screen.getByText(/Independent Variable:\s*1/i)).toBeInTheDocument();
    });
  });

  it("displays all typologies returned by backend alerted_typologies", async () => {
    mockGetAlertById.mockResolvedValue({
      ...baseAlert,
      alerted_typologies: [
        {
          id: "typology-1",
          cfg: "Money Laundering",
          result: 95,
          alertThreshold: 50,
          interdictionThreshold: 80,
          ruleResults: [],
        },
        {
          id: "typology-2",
          cfg: "Structuring",
          result: 75,
          alertThreshold: 60,
          interdictionThreshold: 90,
          ruleResults: [],
        },
      ],
    });

    renderModal();

    await waitFor(() => {
      expect(screen.getByText("Triggered Typologies")).toBeInTheDocument();
      expect(screen.getByText("Money Laundering")).toBeInTheDocument();
      expect(screen.getByText("Structuring")).toBeInTheDocument();
    });

    expect(screen.getByText(/Typology Score:\s*95\.00/i)).toBeInTheDocument();
    expect(screen.getByText(/Typology Score:\s*75\.00/i)).toBeInTheDocument();
    expect(screen.getByText(/Alert Threshold:\s*50/i)).toBeInTheDocument();
    expect(screen.getByText(/Alert Threshold:\s*60/i)).toBeInTheDocument();
  });

  it("toggles typology rule expansion", async () => {
    mockGetAlertById.mockResolvedValue({
      ...baseAlert,
      alerted_typologies: [
        {
          id: "typology-1",
          cfg: "Money Laundering",
          result: 95,
          alertThreshold: 50,
          interdictionThreshold: 80,
          ruleResults: [
            {
              id: "075@1.0.0",
              cfg: "1.0.0",
              wght: 100,
              prcgTm: 32943014,
              tenantId: "DEFAULT",
              subRuleRef: ".02",
              indpdntVarbl: 1,
            },
          ],
        },
      ],
    });

    renderModal();

    await waitFor(() => {
      expect(screen.getByText("075@1.0.0")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Money Laundering/i }));

    expect(screen.queryByText("075@1.0.0")).not.toBeInTheDocument();
  });

  it("shows update alert button in manual mode and calls onManualTriage", async () => {
    mockUseSystemConfig.mockReturnValue({
      isManualMode: true,
      isDisabledMode: false,
      isAIMode: false,
    });

    renderModal({ onManualTriage: mockOnManualTriage });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /update alert/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /update alert/i }));

    expect(mockOnManualTriage).toHaveBeenCalledTimes(1);
    expect(mockOnManualTriage).toHaveBeenCalledWith(
      expect.objectContaining({ alert_id: 123 }),
    );
  });

  it("shows AI processed badge in AI mode", async () => {
    mockUseSystemConfig.mockReturnValue({
      isManualMode: false,
      isDisabledMode: false,
      isAIMode: true,
    });

    renderModal({ onManualTriage: mockOnManualTriage });

    await waitFor(() => {
      expect(screen.getByText("AI Processed")).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: /update alert/i })).not.toBeInTheDocument();
  });

  it("does not show update alert button after alert has been triaged", async () => {
    mockUseSystemConfig.mockReturnValue({
      isManualMode: true,
      isDisabledMode: false,
      isAIMode: false,
    });
    mockGetAlertActionHistory.mockResolvedValue([
      {
        ...actionHistoryItem,
        operation: "ALERT_UPDATED",
        action_performed: "123 - Triaged by user user-1",
      },
    ]);

    renderModal({ onManualTriage: mockOnManualTriage });

    await waitFor(() => {
      expect(screen.getByText(/123 - Triaged by user Jane Doe/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: /update alert/i })).not.toBeInTheDocument();
  });

  it("navigates to case details when case id is clicked", async () => {
    mockUseCase.mockReturnValue({
      data: {
        case_id: 999,
        status: "STATUS_00_DRAFT",
      },
      isLoading: false,
    });
    mockGetAlertById.mockResolvedValue({
      ...baseAlert,
      case_id: 999,
    });

    renderModal({ onNavigateToCase: mockOnNavigateToCase });

    await waitFor(() => {
      expect(screen.getByTitle("View case details")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle("View case details"));

    expect(mockNavigate).toHaveBeenCalledWith("/cases/999");
    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockOnNavigateToCase).toHaveBeenCalledTimes(1);
  });

  it("shows disabled case id when user has no case access", async () => {
    mockUseCase.mockReturnValue({
      data: {
        case_id: 999,
        status: "STATUS_00_DRAFT",
      },
      isLoading: false,
    });
    mockGetAlertById.mockResolvedValue({
      ...baseAlert,
      case_id: 999,
    });
    mockCheckCaseAccess.mockResolvedValue(false);

    renderModal();

    await waitFor(() => {
      expect(
        screen.getByTitle("You don't have permission to view this case"),
      ).toBeInTheDocument();
    });
  });
});
