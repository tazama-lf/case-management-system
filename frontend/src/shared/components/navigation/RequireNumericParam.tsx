import React from 'react';
import { useParams } from 'react-router-dom';
import NotFoundRedirect from './NotFoundRedirect';

// A record id in the address: digits only, no sign, no leading zero, and small enough to be exact in JavaScript
const POSITIVE_INTEGER = /^[1-9]\d*$/u;

export const isPositiveIntegerId = (value: string | undefined): boolean =>
  value !== undefined &&
  POSITIVE_INTEGER.test(value) &&
  Number.isSafeInteger(Number(value));

interface RequireNumericParamProps {
  /** Name of the route parameter, e.g. "caseId" for /cases/:caseId */
  param: string;
  /** Where to send the user when the parameter is not a valid id */
  redirectTo: string;
  notFoundTitle: string;
  notFoundMessage?: string;
  children: React.ReactNode;
}

/**
 * Only renders its children when the route parameter is a valid record id.
 * Anything else (text, zero, negative, decimals, leading zeros) is reported as not found and redirected.
 */
const RequireNumericParam: React.FC<RequireNumericParamProps> = ({
  param,
  redirectTo,
  notFoundTitle,
  notFoundMessage,
  children,
}) => {
  const params = useParams();

  if (!isPositiveIntegerId(params[param])) {
    return (
      <NotFoundRedirect
        to={redirectTo}
        title={notFoundTitle}
        message={notFoundMessage}
      />
    );
  }

  return <>{children}</>;
};

export default RequireNumericParam;
