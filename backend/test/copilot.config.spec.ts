import { agentLimits, anyCopilotFeature, copilotFeatures, strategyName } from '../src/modules/copilot/copilot.config';

describe('copilot configuration', () => {
  it('turns each feature on only when its own variable is exactly "true"', () => {
    expect(copilotFeatures({})).toEqual({ investigation: false, sar: false });
    expect(copilotFeatures({ COPILOT_INVESTIGATION_ENABLED: 'true' })).toEqual({ investigation: true, sar: false });
    expect(copilotFeatures({ COPILOT_SAR_ENABLED: 'true' })).toEqual({ investigation: false, sar: true });
    for (const v of ['', 'false', 'TRUE', '1', 'yes']) {
      expect(copilotFeatures({ COPILOT_INVESTIGATION_ENABLED: v, COPILOT_SAR_ENABLED: v })).toEqual({ investigation: false, sar: false });
    }
    expect(anyCopilotFeature({ investigation: false, sar: true })).toBe(true);
    expect(anyCopilotFeature({ investigation: false, sar: false })).toBe(false);
  });

  it('defaults to the pipeline strategy and only switches on the exact word "agent"', () => {
    expect(strategyName({})).toBe('pipeline');
    expect(strategyName({ COPILOT_STRATEGY: 'agent' })).toBe('agent');
    expect(strategyName({ COPILOT_STRATEGY: 'Agent' })).toBe('pipeline');
  });

  it('reads agent limits, ignoring values that are not positive whole numbers', () => {
    expect(agentLimits({})).toEqual({ maxSteps: 6, maxToolCalls: 8, timeoutMs: 240_000 });
    expect(agentLimits({ COPILOT_AGENT_MAX_STEPS: '3', COPILOT_AGENT_MAX_TOOL_CALLS: '2', COPILOT_AGENT_TIMEOUT_MS: '1000' })).toEqual({ maxSteps: 3, maxToolCalls: 2, timeoutMs: 1000 });
    expect(agentLimits({ COPILOT_AGENT_MAX_STEPS: '0', COPILOT_AGENT_MAX_TOOL_CALLS: '-1', COPILOT_AGENT_TIMEOUT_MS: 'soon' })).toEqual({ maxSteps: 6, maxToolCalls: 8, timeoutMs: 240_000 });
  });
});
