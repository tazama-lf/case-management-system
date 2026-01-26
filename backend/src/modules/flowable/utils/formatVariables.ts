import { FlowableVariable } from '../types/IFlowable';

/**
 * Formats a record of variables into an array of FlowableVariable objects
 * @param variables
 * @returns
 */
export const formatVariables = (variables: Record<string, unknown>): FlowableVariable[] => {
  return Object.entries(variables).map(([name, value]) => {
    if (value === undefined) {
      throw new Error(`Variable "${name}" has undefined value. All variables must have string values.`);
    }
    if (typeof value === 'boolean') {
      return {
        name,
        value: value,
        type: 'boolean',
      };
    }
    return {
      name,
      value: String(value),
      type: 'string',
    };
  });
};
