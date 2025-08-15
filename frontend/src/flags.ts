import { isLocalMode } from './lib/config';

export const agentPlaygroundFlagFrontend = isLocalMode();
export const marketplaceFlagFrontend = isLocalMode();
export const agentPlaygroundEnabled = isLocalMode();
export const marketplaceEnabled = isLocalMode();
