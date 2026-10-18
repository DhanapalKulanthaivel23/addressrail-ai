/** Public JSON boundary. No proprietary engine implementation belongs here. */
export type CapabilityStatus = 'DONE' | 'PARTIAL' | 'PENDING' | 'NOT_APPLICABLE';
export interface Capability { status: CapabilityStatus; evidence: string[]; limitations: string[] }
export interface ProductDefinition {
 id: string; name: string; icon: string; parentProduct: string; subProducts: string[];
 messageTypes: string[]; messageVersions: string[]; standardsReleases: string[];
 transformations: {direction: 'MT_TO_MX' | 'MX_TO_MT'; capability: Capability}[];
 validationRules: string[]; validSamples: string[]; invalidSamples: string[];
 scenarios: {id: string; label: string}[];
 stateMachine: Record<string, string[]>; flow: string[];
 restApis: {method: string; path: string; status: CapabilityStatus}[];
 postmanEntries: string[]; knowledgeReferences: string[];
 implementation: Capability; tabs: string[];
}
export interface DemoRequest {
 contractVersion: 1; synthetic: true; productId: string;
 scenarioId: string; syntheticEpoch: string; payload: Record<string, unknown>;
}
export interface ExecutionStep {
 id: string; input: unknown; output: unknown; messageType: string;
 result: string; findings: unknown[]; syntheticTimestamp: string; correlationReference: string;
}
export interface DemoResponse {
 contractVersion: 1; synthetic: true; productId: string; correlationReference: string;
 steps: ExecutionStep[]; report: unknown;
 ai: {status: 'DETERMINISTIC_FALLBACK'; model: null; retrieval: unknown[];
      suggestedCorrections: unknown[]; revalidation: 'NOT_REQUESTED' | {status:'REVALIDATED_INTERNAL_RULES'; findings:unknown[]}; explanation: string};
}
