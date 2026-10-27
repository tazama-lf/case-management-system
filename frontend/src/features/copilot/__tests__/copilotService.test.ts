import { describe, it, expect, vi } from 'vitest';

vi.mock('@/shared/services/apiClient', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

import { provenanceLabel, sarNarrative, type Provenance, type SarDraft } from '../copilotService';

const provenance: Provenance = {
  promptVersion: '3f2a9c1b77aa',
  strategy: 'pipeline',
  temperature: 0.1,
  maxTokens: 1200,
  meaningCheck: true,
  served: { model: 'qwen3-4b-instruct-2507', file: 'Qwen3-4B-Instruct-2507-Q4_K_M.gguf', quantisation: 'Q4_K_M', build: 'b11398-a7b94df2c' },
};

const draft = (over: Partial<SarDraft> = {}): SarDraft => ({
  id: 240,
  caseId: 27,
  investigationRecordId: 238,
  createdAt: '2026-10-28T09:00:00.000Z',
  model: { mode: 'bundled', model: 'qwen3-4b-instruct-2507', license: 'Apache-2.0', endpoint: 'localhost:8091', dataLeavesDeployment: false, embeddings: 'builtin-hash-512' },
  sections: [
    { key: 'subject', title: 'Subject', factIds: ['F9'], text: { sentences: [{ text: 'The subject is Fatima Iqbal.', cites: ['F9'], ok: true, reasons: [] }], removed: [], writtenBy: 'model' } },
  ],
  indicators: ['Rapid movement of funds'],
  goamlXml: '<report/>',
  checks: [],
  ...over,
});

describe('provenanceLabel', () => {
  it('names the served file, quantisation, build, prompt version, strategy and meaning check', () => {
    expect(provenanceLabel(provenance)).toBe(
      'Qwen3-4B-Instruct-2507-Q4_K_M.gguf, Q4_K_M, build b11398-a7b94df2c · prompts 3f2a9c1b77aa · pipeline · meaning check on',
    );
  });

  it('says when no model was used', () => {
    expect(provenanceLabel({ ...provenance, served: null, meaningCheck: false })).toBe(
      'no model · prompts 3f2a9c1b77aa · pipeline · meaning check off',
    );
  });
});

describe('sarNarrative', () => {
  it('opens with an AI-assistance note that names the model and the records, then the sections', () => {
    const text = sarNarrative(draft({ provenance }));
    const lines = text.split('\n');
    expect(lines[1]).toBe(
      'Prepared with AI assistance by the Tazama CMS copilot (qwen3-4b-instruct-2507, bundled model) from investigation record 238, draft 240.',
    );
    expect(lines[2]).toMatch(/must be reviewed and approved under the CMS maker-checker workflow before filing/);
    expect(lines[3]).toBe(`Produced by: ${provenanceLabel(provenance)}`);
    expect(text).toContain('SUBJECT\nThe subject is Fatima Iqbal.');
    expect(text).toContain('INDICATORS\n- Rapid movement of funds');
    expect(text).not.toMatch(/[–—]/);
  });

  it('says when no model wrote the text', () => {
    const text = sarNarrative(draft({ model: { ...draft().model, mode: 'off', model: null } }));
    expect(text).toContain('(no model, written by code)');
    expect(text).not.toContain('Produced by:');
  });
});
