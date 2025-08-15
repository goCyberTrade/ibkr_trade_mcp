import React from 'react';
import { MCPConfigurationNew } from './mcp/mcp-configuration-new';

interface AgentMCPConfigurationProps {
  configuredMCPs: any[];
  customMCPs: any[];
  onMCPChange: (updates: { configured_mcps: any[]; custom_mcps: any[] }) => void;
  agentId?: string;
  versionData?: {
    configured_mcps?: any[];
    custom_mcps?: any[];
    system_prompt?: string;
    agentpress_tools?: any;
  };
  saveMode?: 'direct' | 'callback';
  versionId?: string;
  isLoading?: boolean;
}

export const AgentMCPConfiguration: React.FC<AgentMCPConfigurationProps> = ({
  configuredMCPs,
  customMCPs,
  onMCPChange,
  agentId,
  versionData,
  saveMode = 'direct',
  versionId,
  isLoading = false
}) => {
  const allMCPs = [
    ...(configuredMCPs || []),
    ...(customMCPs || []).map(customMcp => {
      if (customMcp.type === 'composio' || customMcp.customType === 'composio') {
        return {
          name: customMcp.name,
          qualifiedName: customMcp.mcp_qualified_name || customMcp.config?.mcp_qualified_name || customMcp.qualifiedName || `composio.${customMcp.toolkit_slug || customMcp.config?.toolkit_slug || customMcp.name.toLowerCase()}`,
          mcp_qualified_name: customMcp.mcp_qualified_name || customMcp.config?.mcp_qualified_name,
          config: customMcp.config,
          enabledTools: customMcp.enabledTools,
          isCustom: true,
          customType: 'composio',
          isComposio: true,
          toolkitSlug: customMcp.toolkit_slug || customMcp.config?.toolkit_slug,
          toolkit_slug: customMcp.toolkit_slug || customMcp.config?.toolkit_slug  // Add for logo system
        };
      }
      
      return {
        name: customMcp.name,
        qualifiedName: customMcp.qualifiedName || `custom_${customMcp.type || customMcp.customType}_${customMcp.name.replace(' ', '_').toLowerCase()}`,
        config: customMcp.config,
        enabledTools: customMcp.enabledTools,
        isCustom: true,
        customType: customMcp.type || customMcp.customType
      };
    })
  ];

  const handleConfigurationChange = (mcps: any[]) => {
    const configured = mcps.filter(mcp => !mcp.isCustom);
    const custom = mcps
      .filter(mcp => mcp.isCustom)
      .map(mcp => {
        if (mcp.customType === 'composio' || mcp.isComposio) {
          return {
            name: mcp.name,
            type: 'composio',
            customType: 'composio',
            config: mcp.config,
            enabledTools: mcp.enabledTools
          };
        }
        
        return {
          name: mcp.name,
          type: mcp.customType,
          customType: mcp.customType,
          config: mcp.config,
          enabledTools: mcp.enabledTools
        };
      });

    onMCPChange({
      configured_mcps: configured,
      custom_mcps: custom
    });
  };

  return (
    <MCPConfigurationNew
      configuredMCPs={allMCPs}
      onConfigurationChange={handleConfigurationChange}
      agentId={agentId}
      versionData={versionData}
      saveMode={saveMode}
      versionId={versionId}
      isLoading={isLoading}
    />
  );
}; 